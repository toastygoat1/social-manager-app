import { apiFetch } from "@/lib/api/client";
import {
  EMPTY_DASHBOARD,
  type DashboardData,
} from "@/app/dashboard/_components/data";

const DASHBOARD_POSTS_ENDPOINT = "/dashboard/posts";

export type PostsData = Pick<
  DashboardData,
  "accounts" | "metadataFields" | "contentRows"
>;

const EMPTY_POSTS_DATA: PostsData = {
  accounts: EMPTY_DASHBOARD.accounts,
  metadataFields: EMPTY_DASHBOARD.metadataFields,
  contentRows: EMPTY_DASHBOARD.contentRows,
};

export async function getPostsData(): Promise<PostsData> {
  try {
    return await apiFetch<PostsData>(DASHBOARD_POSTS_ENDPOINT);
  } catch (error) {
    console.error("getPostsData failed", error);
    return EMPTY_POSTS_DATA;
  }
}
