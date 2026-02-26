import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { learnFromApproval, learnFromSkip } from "@/lib/interest-learner";
import { trackScoringAccuracy } from "@/lib/scoring";

/**
 * GET /api/papers/review — レビュー対象論文を取得
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") || "pending";
  const sort = searchParams.get("sort") || "score_desc";
  const limit = parseInt(searchParams.get("limit") || "20");

  // バリデーション
  const allowedStatuses = ["pending", "auto_skipped"];
  const filterStatus = allowedStatuses.includes(status) ? status : "pending";

  // 件数取得
  const { count: totalPending } = await supabase
    .from("papers")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "pending");

  const { count: totalAutoSkipped } = await supabase
    .from("papers")
    .select("*", { count: "exact", head: true })
    .eq("review_status", "auto_skipped");

  // 論文取得
  let query = supabase
    .from("papers")
    .select("*")
    .eq("review_status", filterStatus);

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
    total_auto_skipped: totalAutoSkipped || 0,
  });
}

/**
 * POST /api/papers/review — レビュー判定（approve / skip / restore）
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

  if (!["approve", "skip", "restore"].includes(action)) {
    return NextResponse.json(
      {
        error:
          "action は 'approve', 'skip', 'restore' のいずれかを指定してください",
      },
      { status: 400 },
    );
  }

  // restore: auto_skipped → pending
  if (action === "restore") {
    const { data, error } = await supabase
      .from("papers")
      .update({ review_status: "pending" })
      .eq("id", paper_id)
      .eq("review_status", "auto_skipped")
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      review_status: "pending",
      paper: data,
    });
  }

  // approve / skip
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

  // スコアリング精度のトラッキング
  try {
    await trackScoringAccuracy(data.id, data.relevance_score, action);
  } catch (e) {
    console.error("Scoring tracking error:", e);
  }

  // 関心プロファイルの自動学習
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
