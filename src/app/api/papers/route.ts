import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.title_original) {
    return NextResponse.json({ error: "タイトル（原題）は必須です" }, { status: 400 });
  }

  const insertData = {
    title_original: body.title_original,
    title_ja: body.title_ja || null,
    authors: body.authors || [],
    published_date: body.published_date || null,
    journal: body.journal || null,
    doi: body.doi || null,
    url: body.url || null,
    summary_ja: body.summary_ja || null,
    explanation_ja: body.explanation_ja || null,
    source: body.source || "manual",
    google_drive_url: body.google_drive_url || null,
    memo: body.memo || null,
  };

  const { data, error } = await supabase.from("papers").insert(insertData).select().single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "同じDOIの論文が既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sort = searchParams.get("sort") || "collected_at";
  const order = searchParams.get("order") || "desc";
  const search = searchParams.get("search") || "";
  const favorite = searchParams.get("favorite");
  const keywordId = searchParams.get("keyword_id") || "";
  const dateFrom = searchParams.get("date_from") || "";
  const dateTo = searchParams.get("date_to") || "";

  const offset = (page - 1) * limit;

  // キーワードフィルタがある場合はpaper_keywordsをJOINして絞り込む
  if (keywordId) {
    // まず該当キーワードに紐づくpaper_idを取得
    const { data: pkData } = await supabase
      .from("paper_keywords")
      .select("paper_id")
      .eq("keyword_id", keywordId);

    const paperIds = (pkData || []).map((pk: { paper_id: string }) => pk.paper_id);

    if (paperIds.length === 0) {
      return NextResponse.json({
        papers: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    let query = supabase
      .from("papers")
      .select("*", { count: "exact" })
      .in("id", paperIds)
      .in("review_status", ["approved", "auto_approved"]);

    if (favorite === "true") {
      query = query.eq("is_favorite", true);
    }

    if (search) {
      query = query.or(
        `title_original.ilike.%${search}%,title_ja.ilike.%${search}%,summary_ja.ilike.%${search}%,memo.ilike.%${search}%`,
      );
    }

    if (dateFrom) {
      query = query.gte("collected_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("collected_at", `${dateTo}T23:59:59.999Z`);
    }

    const ascending = order === "asc";
    query = query.order(sort, { ascending });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      papers: data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  }

  // キーワードフィルタなしの通常クエリ（approved / auto_approved のみ表示）
  let query = supabase
    .from("papers")
    .select("*", { count: "exact" })
    .in("review_status", ["approved", "auto_approved"]);

  if (favorite === "true") {
    query = query.eq("is_favorite", true);
  }

  if (search) {
    query = query.or(
      `title_original.ilike.%${search}%,title_ja.ilike.%${search}%,summary_ja.ilike.%${search}%,memo.ilike.%${search}%`,
    );
  }

  // 日付範囲フィルタ
  if (dateFrom) {
    query = query.gte("collected_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("collected_at", `${dateTo}T23:59:59.999Z`);
  }

  const ascending = order === "asc";
  query = query.order(sort, { ascending });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    papers: data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
