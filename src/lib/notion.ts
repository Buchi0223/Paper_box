import { Client } from "@notionhq/client";
import type { Paper } from "@/types/database";

let notionClient: Client | null = null;

function getNotionClient(): Client {
  if (notionClient) return notionClient;

  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");

  notionClient = new Client({ auth: token });
  return notionClient;
}

/**
 * データベースに必要なプロパティが存在しない場合、自動作成する
 */
async function ensureDatabaseProperties(databaseId: string): Promise<void> {
  const notion = getNotionClient();
  const db = await notion.databases.retrieve({ database_id: databaseId });

  const props = "properties" in db ? (db.properties as Record<string, { type: string }>) : {};
  const existing = new Set(Object.keys(props));

  // デフォルトの「名前」プロパティを「タイトル」にリネーム
  const titleProp = Object.entries(props).find(
    ([, v]) => v.type === "title",
  );
  const titlePropName = titleProp ? titleProp[0] : null;

  // タイトルプロパティのリネームを先に実行
  if (titlePropName && titlePropName !== "タイトル") {
    const renameRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ properties: { [titlePropName]: { name: "タイトル" } } }),
    });
    if (!renameRes.ok) {
      const err = await renameRes.json();
      console.error("[Notion] Failed to rename title property:", err);
    }
  }

  const propsToCreate: Record<string, unknown> = {};

  const requiredProps: Record<string, unknown> = {
    "Original Title": { rich_text: {} },
    Authors: { rich_text: {} },
    Source: { select: { options: [] } },
    "PaperShelf ID": { rich_text: {} },
    ステータス: { select: { options: [{ name: "未読" }, { name: "読了" }] } },
    "Published Date": { date: {} },
    Journal: { rich_text: {} },
    DOI: { url: {} },
    論文URL: { url: {} },
    "Google Drive": { url: {} },
    AIスコア: { number: {} },
  };

  for (const [name, schema] of Object.entries(requiredProps)) {
    if (!existing.has(name)) {
      propsToCreate[name] = schema;
    }
  }

  if (Object.keys(propsToCreate).length > 0) {
    // SDK v5.12.0 の databases.update は bodyParams に properties を含まないため、
    // 直接 fetch で Notion API を呼ぶ
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ properties: propsToCreate }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Failed to update database properties: ${err.message}`);
    }
  }
}

export async function exportPaperToNotion(
  paper: Paper,
  databaseId: string,
): Promise<{ page_id: string; page_url: string }> {
  const notion = getNotionClient();

  // 初回エクスポート時にプロパティを自動セットアップ
  if (!paper.notion_page_id) {
    await ensureDatabaseProperties(databaseId);
  }

  const title = paper.title_ja || paper.title_original;
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null;
  const authors = paper.authors?.join(", ") || "";
  const paperShelfUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/papers/${paper.id}`;

  const properties: Record<string, unknown> = {
    タイトル: { title: [{ text: { content: title } }] },
    "Original Title": {
      rich_text: [{ text: { content: paper.title_original } }],
    },
    Authors: { rich_text: [{ text: { content: authors } }] },
    Source: { select: { name: paper.source } },
    "PaperShelf ID": { rich_text: [{ text: { content: paper.id } }] },
    ステータス: { select: { name: "未読" } },
  };

  if (paper.published_date) {
    properties["Published Date"] = {
      date: { start: paper.published_date },
    };
  }
  if (paper.journal) {
    properties["Journal"] = {
      rich_text: [{ text: { content: paper.journal } }],
    };
  }
  if (doiUrl) {
    properties["DOI"] = { url: doiUrl };
  }
  if (paper.url) {
    properties["論文URL"] = { url: paper.url };
  }
  if (paper.google_drive_url) {
    properties["Google Drive"] = { url: paper.google_drive_url };
  }
  if (paper.relevance_score !== null && paper.relevance_score !== undefined) {
    properties["AIスコア"] = { number: paper.relevance_score };
  }

  // 再エクスポート: プロパティ更新 + リンクブロック更新（精読メモを保護）
  if (paper.notion_page_id) {
    // ステータスは更新時に上書きしない
    delete properties["ステータス"];

    await notion.pages.update({
      page_id: paper.notion_page_id,
      properties: properties as Parameters<
        typeof notion.pages.update
      >[0]["properties"],
    });

    // リンクセクションのブックマークブロックを更新
    await updateLinkBlocks(paper.notion_page_id, paper, paperShelfUrl);

    const page = await notion.pages.retrieve({
      page_id: paper.notion_page_id,
    });
    const pageUrl =
      "url" in page ? (page.url as string) : paper.notion_page_url || "";

    return { page_id: paper.notion_page_id, page_url: pageUrl };
  }

  // 新規エクスポート: ページ作成
  const children = buildPageBlocks(paper, paperShelfUrl);

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as Parameters<
      typeof notion.pages.create
    >[0]["properties"],
    children,
  });

  const pageUrl = "url" in response ? (response.url as string) : "";

  return { page_id: response.id, page_url: pageUrl };
}

const NOTION_TEXT_LIMIT = 2000;

type NotionBlocks = NonNullable<Parameters<typeof Client.prototype.pages.create>[0]["children"]>;

/** 長いテキストを2000文字以下のparagraphブロック群に分割して追加 */
function pushParagraphBlocks(
  blocks: NotionBlocks,
  text: string,
): void {
  if (!text) {
    blocks.push({
      object: "block" as const,
      type: "paragraph" as const,
      paragraph: { rich_text: [{ type: "text" as const, text: { content: "（未生成）" } }] },
    });
    return;
  }
  for (let i = 0; i < text.length; i += NOTION_TEXT_LIMIT) {
    blocks.push({
      object: "block" as const,
      type: "paragraph" as const,
      paragraph: {
        rich_text: [{ type: "text" as const, text: { content: text.slice(i, i + NOTION_TEXT_LIMIT) } }],
      },
    });
  }
}

/**
 * 再エクスポート時に「リンク」セクションのブックマークブロックを差し替える。
 * ユーザーの精読メモ等は保護したまま、リンクブロックのみ更新する。
 */
async function updateLinkBlocks(
  pageId: string,
  paper: Paper,
  paperShelfUrl: string,
): Promise<void> {
  const notion = getNotionClient();

  const response = await notion.blocks.children.list({ block_id: pageId });
  const blocks = response.results as Array<{
    id: string;
    type: string;
    heading_2?: { rich_text: Array<{ plain_text: string }> };
  }>;

  // 「リンク」見出しのインデックスを検索
  let linkHeadingIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (
      block.type === "heading_2" &&
      block.heading_2?.rich_text?.[0]?.plain_text === "リンク"
    ) {
      linkHeadingIndex = i;
      break;
    }
  }

  if (linkHeadingIndex === -1) return; // 見出しがなければスキップ

  // 見出し直後のブックマークブロックを収集・削除
  for (let i = linkHeadingIndex + 1; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "heading_2") break; // 次のセクションに到達
    if (block.type === "bookmark") {
      try {
        await notion.blocks.delete({ block_id: block.id });
      } catch (error) {
        console.error("[Notion] ブックマークブロック削除失敗:", block.id, error);
      }
    }
  }

  // 新しいブックマークブロックを「リンク」見出しの後に追加
  const newBookmarks: NotionBlocks = [];
  if (paper.url) {
    newBookmarks.push({
      object: "block" as const,
      type: "bookmark" as const,
      bookmark: { url: paper.url, caption: [] },
    });
  }
  if (paper.google_drive_url) {
    newBookmarks.push({
      object: "block" as const,
      type: "bookmark" as const,
      bookmark: { url: paper.google_drive_url, caption: [] },
    });
  }
  newBookmarks.push({
    object: "block" as const,
    type: "bookmark" as const,
    bookmark: { url: paperShelfUrl, caption: [] },
  });

  if (newBookmarks.length > 0) {
    // 「リンク」見出しの直後に挿入（after パラメータ使用）
    await notion.blocks.children.append({
      block_id: pageId,
      after: blocks[linkHeadingIndex].id,
      children: newBookmarks,
    });
  }
}

function buildPageBlocks(
  paper: Paper,
  paperShelfUrl: string,
): Parameters<typeof Client.prototype.pages.create>[0]["children"] {
  const blocks: Parameters<typeof Client.prototype.pages.create>[0]["children"] =
    [];

  // 1. callout: 原題
  blocks.push({
    object: "block" as const,
    type: "callout" as const,
    callout: {
      icon: { type: "emoji" as const, emoji: "📄" as const },
      rich_text: [
        { type: "text" as const, text: { content: paper.title_original } },
      ],
    },
  });

  // 2. divider
  blocks.push({
    object: "block" as const,
    type: "divider" as const,
    divider: {},
  });

  // 3. メタ情報
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: "メタ情報" } }],
    },
  });

  const metaItems = [
    `著者: ${paper.authors?.join(", ") || "不明"}`,
    `出版日: ${paper.published_date || "不明"}`,
    `ジャーナル: ${paper.journal || "不明"}`,
    `DOI: ${paper.doi || "なし"}`,
    `ソース: ${paper.source} | AIスコア: ${paper.relevance_score ?? "なし"}`,
  ];

  for (const item of metaItems) {
    blocks.push({
      object: "block" as const,
      type: "bulleted_list_item" as const,
      bulleted_list_item: {
        rich_text: [{ type: "text" as const, text: { content: item } }],
      },
    });
  }

  // 4. リンク
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: "リンク" } }],
    },
  });

  if (paper.url) {
    blocks.push({
      object: "block" as const,
      type: "bookmark" as const,
      bookmark: { url: paper.url, caption: [] },
    });
  }
  if (paper.google_drive_url) {
    blocks.push({
      object: "block" as const,
      type: "bookmark" as const,
      bookmark: { url: paper.google_drive_url, caption: [] },
    });
  }
  blocks.push({
    object: "block" as const,
    type: "bookmark" as const,
    bookmark: { url: paperShelfUrl, caption: [] },
  });

  // 5. divider
  blocks.push({
    object: "block" as const,
    type: "divider" as const,
    divider: {},
  });

  // 6. AI要約
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: "AI要約" } }],
    },
  });
  pushParagraphBlocks(blocks, paper.summary_ja || "");

  // 7. AI解説
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: "AI解説" } }],
    },
  });
  pushParagraphBlocks(blocks, paper.explanation_ja || "");

  // 8. divider
  blocks.push({
    object: "block" as const,
    type: "divider" as const,
    divider: {},
  });

  // 9. PaperShelfメモ
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [
        { type: "text" as const, text: { content: "PaperShelfメモ" } },
      ],
    },
  });
  pushParagraphBlocks(blocks, paper.memo || "（メモなし）");

  // 10. divider
  blocks.push({
    object: "block" as const,
    type: "divider" as const,
    divider: {},
  });

  // 11. 精読メモ
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [
        { type: "text" as const, text: { content: "精読メモ" } },
      ],
    },
  });
  blocks.push({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: {
            content:
              "以下のセクションに精読結果を記入してください。再エクスポート時もこのセクションは保護されます。",
          },
        },
      ],
    },
  });

  // 12. 精読メモ テンプレート見出し
  const readingNoteHeadings = [
    "研究の目的",
    "手法の詳細",
    "結果と考察",
    "自分の研究との関連",
    "疑問・次のアクション",
  ];

  for (const heading of readingNoteHeadings) {
    blocks.push({
      object: "block" as const,
      type: "heading_3" as const,
      heading_3: {
        rich_text: [{ type: "text" as const, text: { content: heading } }],
      },
    });
  }

  return blocks;
}

export async function verifyConnection(databaseId: string): Promise<boolean> {
  try {
    const notion = getNotionClient();
    await notion.databases.retrieve({ database_id: databaseId });
    return true;
  } catch (error) {
    console.error("[Notion verifyConnection] error:", error);
    return false;
  }
}
