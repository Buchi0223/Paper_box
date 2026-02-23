import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { learnFromApproval, learnFromSkip } from "@/lib/interest-learner";

/**
 * GET /api/papers/review — 未レビュー論文を取得
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get("sort") || "score_desc";
  const limit = parseInt(searchParams.get("limit") || "20");

  // 未レビュー件数を取得
  const { count: totalPending } = await supabase
    .from("papers")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "pending");

  // 未レビュー論文を取得
  let query = supabase
    .from("papers")
    .select("*")
    .eq("review_status", "pending");

  if (sort === "score_desc") {
    query = query.order("relevance_score", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    query = query.order("collected_at", { ascending: false });
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    papers: data || [],
    total_pending: totalPending || 0,
  });
}

/**
 * POST /api/papers/review — レビュー判定（approve / skip）
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { paper_id, action } = body;

  if (!paper_id || !action) {
    return NextResponse.json(
      { error: "paper_id と action は必須です" },
      { status: 400 },
    );
  }

  if (action !== "approve" && action !== "skip") {
    return NextResponse.json(
      { error: "action は 'approve' または 'skip' を指定してください" },
      { status: 400 },
    );
  }

  const reviewStatus = action === "approve" ? "approved" : "skipped";

  const { data, error } = await supabase
    .from("papers")
    .update({ review_status: reviewStatus })
    .eq("id", paper_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 関心プロファイルの自動学習（バックグラウンド、レスポンスをブロックしない）
  let learnedInterests: string[] = [];
  try {
    if (action === "approve") {
      learnedInterests = await learnFromApproval(data);
    } else {
      await learnFromSkip(data);
    }
  } catch (e) {
    console.error("Interest learning error:", e);
  }

  return NextResponse.json({
    success: true,
    review_status: reviewStatus,
    paper: data,
    learned_interests: learnedInterests,
  });
}
