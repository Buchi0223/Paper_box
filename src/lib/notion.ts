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

export async function exportPaperToNotion(
  paper: Paper,
  databaseId: string,
): Promise<{ page_id: string; page_url: string }> {
  const notion = getNotionClient();

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

  // 再エクスポート: プロパティのみ更新（精読メモを保護）
  if (paper.notion_page_id) {
    // ステータスは更新時に上書きしない
    delete properties["ステータス"];

    await notion.pages.update({
      page_id: paper.notion_page_id,
      properties: properties as Parameters<
        typeof notion.pages.update
      >[0]["properties"],
    });

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
  blocks.push({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: paper.summary_ja || "（未生成）" },
        },
      ],
    },
  });

  // 7. AI解説
  blocks.push({
    object: "block" as const,
    type: "heading_2" as const,
    heading_2: {
      rich_text: [{ type: "text" as const, text: { content: "AI解説" } }],
    },
  });
  blocks.push({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: paper.explanation_ja || "（未生成）" },
        },
      ],
    },
  });

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
  blocks.push({
    object: "block" as const,
    type: "paragraph" as const,
    paragraph: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: paper.memo || "（メモなし）" },
        },
      ],
    },
  });

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
  } catch {
    return false;
  }
}
