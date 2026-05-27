import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InfomaniakClient } from "../services/client.js";
import {
  PaginationSchema,
  ResponseFormatSchema,
} from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import {
  envelopeToPagination,
  runPaginatedTool,
  runTool,
} from "../services/format.js";

const DriveId = z
  .number()
  .int()
  .positive()
  .describe("Numeric kDrive ID (see infomaniak_list_kdrives).");

const FileId = z
  .number()
  .int()
  .positive()
  .describe("Numeric file or directory ID.");

const ParentId = z
  .number()
  .int()
  .positive()
  .default(1)
  .describe("Parent directory ID. Root is 1.");

const ListDrivesInput = z.object({ response_format: ResponseFormatSchema }).strict();
type ListDrivesArgs = z.infer<typeof ListDrivesInput>;

const ListFilesInput = z
  .object({
    drive_id: DriveId,
    parent_id: ParentId,
    order: z.enum(["asc", "desc"]).default("asc"),
    order_by: z
      .enum(["type", "name", "size", "last_modified_at"])
      .default("name"),
    ...PaginationSchema,
    response_format: ResponseFormatSchema,
  })
  .strict();
type ListFilesArgs = z.infer<typeof ListFilesInput>;

const GetFileInput = z
  .object({
    drive_id: DriveId,
    file_id: FileId,
    response_format: ResponseFormatSchema,
  })
  .strict();
type GetFileArgs = z.infer<typeof GetFileInput>;

const CreateDirInput = z
  .object({
    drive_id: DriveId,
    parent_id: ParentId,
    name: z.string().min(1).max(255),
    response_format: ResponseFormatSchema,
  })
  .strict();
type CreateDirArgs = z.infer<typeof CreateDirInput>;

const DeleteFileInput = z
  .object({
    drive_id: DriveId,
    file_id: FileId,
    confirm: z
      .boolean()
      .default(false)
      .describe(
        "Must be true to actually trash the file; false returns a dry-run.",
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();
type DeleteFileArgs = z.infer<typeof DeleteFileInput>;

const ShareLinkInput = z
  .object({
    drive_id: DriveId,
    file_id: FileId,
    permission: z.enum(["read", "write"]).default("read"),
    password: z.string().min(4).optional(),
    valid_until: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Unix timestamp (seconds) at which the link expires."),
    response_format: ResponseFormatSchema,
  })
  .strict();
type ShareLinkArgs = z.infer<typeof ShareLinkInput>;

export function register(server: McpServer, client: InfomaniakClient) {
  server.registerTool(
    "infomaniak_list_kdrives",
    {
      title: "List kDrives",
      description: `List kDrives the user has access to.

Args:
  - response_format ('markdown'|'json').

Returns:
  Envelope with array of { id, name, size, used_size, role, ... }.`,
      inputSchema: ListDrivesInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }: ListDrivesArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        "kDrives",
        () => client.request("GET", "/2/drive"),
      ),
  );

  server.registerTool(
    "infomaniak_list_kdrive_files",
    {
      title: "List children of a kDrive directory",
      description: `List the children of a directory on a kDrive.

Args:
  - drive_id (number).
  - parent_id (number): directory to list (default 1 = root).
  - order ('asc'|'desc'): default 'asc'.
  - order_by ('type'|'name'|'size'|'last_modified_at'): default 'name'.
  - page, per_page: pagination.
  - response_format ('markdown'|'json').

Returns:
  Pagination payload with items { id, name, type, size, last_modified_at, ... }.`,
      inputSchema: ListFilesInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListFilesArgs) => {
      const page = params.page ?? 1;
      const per_page = params.per_page ?? 25;
      const parent_id = params.parent_id ?? 1;
      return runPaginatedTool(
        params.response_format ?? ResponseFormat.MARKDOWN,
        `kDrive ${params.drive_id} files in ${parent_id}`,
        async () => {
          const env = await client.requestEnvelope<unknown[]>(
            "GET",
            `/2/drive/${params.drive_id}/files/${parent_id}/files`,
            {
              query: {
                order: params.order,
                order_by: params.order_by,
                page,
                per_page,
              },
            },
          );
          return envelopeToPagination(env, page, per_page);
        },
      );
    },
  );

  server.registerTool(
    "infomaniak_get_kdrive_file",
    {
      title: "Get metadata for one kDrive file/directory",
      description: `Get metadata for a single file or directory on a kDrive.

Args:
  - drive_id (number).
  - file_id (number).
  - response_format ('markdown'|'json').`,
      inputSchema: GetFileInput.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ drive_id, file_id, response_format }: GetFileArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `kDrive file ${file_id}`,
        () => client.request("GET", `/2/drive/${drive_id}/files/${file_id}`),
      ),
  );

  server.registerTool(
    "infomaniak_create_kdrive_directory",
    {
      title: "Create a directory on a kDrive",
      description: `Create a directory on a kDrive.

Args:
  - drive_id (number).
  - parent_id (number): default 1 (root).
  - name (string, 1-255).
  - response_format ('markdown'|'json').

Error Handling:
  - 409: a sibling with the same name already exists.`,
      inputSchema: CreateDirInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      drive_id,
      parent_id,
      name,
      response_format,
    }: CreateDirArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Create directory on kDrive ${drive_id}`,
        () =>
          client.request(
            "POST",
            `/2/drive/${drive_id}/files/${parent_id ?? 1}/directory`,
            { body: { name } },
          ),
      ),
  );

  server.registerTool(
    "infomaniak_delete_kdrive_file",
    {
      title: "Trash a kDrive file/directory",
      description: `Move a file or directory to the kDrive trash. DESTRUCTIVE (recoverable from the trash until purge).

Args:
  - drive_id (number).
  - file_id (number).
  - confirm (boolean): must be true to actually trash; false returns a dry-run.
  - response_format ('markdown'|'json').`,
      inputSchema: DeleteFileInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({
      drive_id,
      file_id,
      confirm,
      response_format,
    }: DeleteFileArgs) => {
      if (!confirm) {
        return runTool(
          response_format ?? ResponseFormat.MARKDOWN,
          "Dry-run trash kDrive file",
          async () => ({
            dry_run: true,
            message:
              "confirm=false: nothing trashed. Re-run with confirm=true to move to trash.",
            request: {
              method: "DELETE",
              path: `/2/drive/${drive_id}/files/${file_id}`,
            },
          }),
        );
      }
      return runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Trash kDrive file ${file_id}`,
        () =>
          client.request("DELETE", `/2/drive/${drive_id}/files/${file_id}`),
      );
    },
  );

  server.registerTool(
    "infomaniak_share_kdrive_file",
    {
      title: "Create a public share link",
      description: `Create a public share link for a file or directory on a kDrive.

Args:
  - drive_id (number).
  - file_id (number).
  - permission ('read'|'write'): default 'read'.
  - password (string, optional, 4+ chars).
  - valid_until (number, optional): unix timestamp in seconds.
  - response_format ('markdown'|'json').`,
      inputSchema: ShareLinkInput.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      drive_id,
      file_id,
      permission,
      password,
      valid_until,
      response_format,
    }: ShareLinkArgs) =>
      runTool(
        response_format ?? ResponseFormat.MARKDOWN,
        `Share link for file ${file_id}`,
        () =>
          client.request("POST", `/2/drive/${drive_id}/files/${file_id}/link`, {
            body: { permission, password, valid_until },
          }),
      ),
  );
}
