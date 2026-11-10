// Generated from the OpenRPC document of Sample RPC API 1.0.0. Do not edit, generate it again.
import { RpcClient } from "../../src/net/index";

/** Only these fields, whatever else the table gets. Their types come from the entity. */
export interface AssigneeResource {
  id?: number | null;
  name?: string;
}

export interface Query_TaskResource {
  /** Fields, with what to select of relations in brackets. A star means all columns, without relations. */
  select?: string;
  /** The same as the members below, for nested collections by their path like `orders` or `orders/items`. */
  criteria?: Record<string, QueryCriteria>;
  /** Every word must appear in one of the searchable fields. */
  search?: string;
  page?: number;
  pageSize?: number;
  /** The same as `pageSize`. */
  take?: number;
  /** Rows to leave out, instead of `page`. */
  skip?: number;
  sort?: QuerySort_TaskResource[];
  filter?: QueryFilterGroup_TaskResource | QueryFilterGroup_TaskResource[] | QueryFilter_TaskResource;
}

export interface QueryCriteria {
  search?: string;
  page?: number;
  pageSize?: number;
  take?: number;
  skip?: number;
  sort?: {
    field?: string;
    dir?: "asc" | "desc";
  }[];
  /** The same form as `filter` of the query, with the fields of that collection. */
  filter?: unknown;
}

export interface QueryFilter_TaskResource {
  /** A field, or a path through relations like `role.name`. */
  field: "id" | "name" | "status" | "priority" | "dueDate" | "assignee.id" | "assignee.name";
  /** Kendo UI operators such as `eq`, `neq`, `lt`, `gte`, `contains`, `startswith`, `isnull`, and also `in`, `not in`, `isweek`, `thisweek`, `today`. */
  operator?: string;
  /** What to compare with; a list for `in`. */
  value?: unknown;
}

export interface QueryFilterGroup_TaskResource {
  logic?: "and" | "or";
  filters?: (QueryFilter_TaskResource | QueryFilterGroup_TaskResource)[];
}

export interface QuerySort_TaskResource {
  field: "id" | "name" | "status" | "priority" | "dueDate" | "assignee.id" | "assignee.name";
  dir?: "asc" | "desc";
}

/** A task, as clients see one. Whatever isn't here doesn't exist for them. */
export interface TaskResource {
  id?: number | null;
  /** What's to be done */
  name?: string;
  status?: string;
  priority?: number;
  /** Format: date. */
  dueDate?: string | null;
  assignee?: AssigneeResource | null;
  label?: string;
  canEdit?: boolean | null;
}

export interface RpcMethods {
  /** Lists tasks. */
  "stats.tasks": {
    params: {
      /** Fields: `id`, `name`, `status`, `priority`, `dueDate`, `label`, `canEdit`. Relations: `assignee`. Search looks in: `name`. */
      query?: Query_TaskResource;
    };
    result: {
      data: TaskResource[];
      /** Records matching the query, on all pages. */
      total: number;
      /** This page, from 1. */
      page: number;
      pageSize: number;
      /** Index of the first record on this page, from 0; null for a page past the end. */
      from: number | null;
      /** Index of the last record on this page, from 0; null for a page past the end. */
      to: number | null;
    };
  };
}

/** Typed client. Register an instance in the container: `new SampleApi('/rpc')`. */
export class SampleApi extends RpcClient<RpcMethods> {}
