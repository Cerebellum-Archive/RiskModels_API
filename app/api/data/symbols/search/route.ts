import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/data/symbols/search?q=AAPL&limit=50
 *
 * Search symbols table by ticker or company name (ilike).
 * Also supports ?asset_type=stock to filter by asset type.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
  const assetType = searchParams.get("asset_type");

  const supabase = createAdminClient();

  let query = supabase
    .from("symbols")
    .select("symbol, ticker, name, asset_type, sector_etf, subsector_etf, is_adr, isin, metadata");

  if (q) {
    query = query.or(`ticker.ilike.%${q}%,name.ilike.%${q}%`);
  }

  if (assetType) {
    query = query.eq("asset_type", assetType);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[data/symbols/search] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
