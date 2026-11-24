import { apiClient } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type {
  DashboardActionRequiredItem,
  DashboardActivityItem,
  DashboardCaseTab,
  DashboardSummaryResponse,
} from "@/types/dashboard";

export async function getDashboardSummary(
  tab: DashboardCaseTab = "ALL"
): Promise<ApiSuccessResponse<DashboardSummaryResponse>> {
  return apiClient.get<ApiSuccessResponse<DashboardSummaryResponse>>(
    "/api/dashboard/summary",
    {
      query: tab === "ALL" ? undefined : { tab },
    }
  );
}

export async function getDashboardActionRequired(): Promise<
  ApiSuccessResponse<DashboardActionRequiredItem[]>
> {
  return apiClient.get<ApiSuccessResponse<DashboardActionRequiredItem[]>>(
    "/api/dashboard/action-required"
  );
}

export async function getDashboardActivities(): Promise<
  ApiSuccessResponse<DashboardActivityItem[]>
> {
  return apiClient.get<ApiSuccessResponse<DashboardActivityItem[]>>(
    "/api/dashboard/activities"
  );
}
