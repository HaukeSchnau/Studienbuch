import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { User } from "../user.type";
import { Actions } from "./Actions";
import { TextFieldCell } from "./Fields";
import { Status } from "./Status";

interface Props {
  users: User[];
  updateRow: (
    rowIndex: number,
    update: Pick<User, "id"> & Partial<User>,
  ) => void;
  updates: Map<string, Partial<User>>;
  onClickChangePassword: (user: User) => void;
  onClickPermissions: (user: User) => void;
  onClickDelete: (user: User) => void;
}

const column = createColumnHelper<User>();

function useSkipper() {
  const shouldSkipRef = useRef(true);
  const shouldSkip = shouldSkipRef.current;

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = useCallback(() => {
    shouldSkipRef.current = false;
  }, []);

  useEffect(() => {
    shouldSkipRef.current = true;
  });

  return [shouldSkip, skip] as const;
}

export const UsersTable = ({
  users,
  updateRow,
  updates,
  onClickChangePassword,
  onClickPermissions,
  onClickDelete,
}: Props) => {
  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper();

  const handleUpdateRow = useCallback(
    (rowIndex: number, update: Pick<User, "id"> & Partial<User>) => {
      updateRow(rowIndex, update);
      skipAutoResetPageIndex();
    },
    [updateRow, skipAutoResetPageIndex],
  );

  const columns = useMemo(
    () => [
      // column.accessor("title", {
      //   header: "Anrede",
      //   cell: ({ getValue, row }) => (
      //     <TextFieldCell
      //       value={getValue() ?? ""}
      //       updateData={(value) =>
      //         handleUpdateRow(row.index, {
      //           id: row.original.id,
      //           title: value ? value : null,
      //         })
      //       }
      //       isDirty={updates.get(row.original.id)?.title !== undefined}
      //     />
      //   ),
      // }),
      // column.accessor("name", {
      //   header: "Name",
      //   cell: ({ getValue, row }) => (
      //     <TextFieldCell
      //       value={getValue()}
      //       updateData={(value) =>
      //         handleUpdateRow(row.index, { id: row.original.id, name: value })
      //       }
      //       isDirty={updates.get(row.original.id)?.name !== undefined}
      //     />
      //   ),
      // }),
      // column.accessor("abbrv", {
      //   header: "Kürzel",
      //   cell: ({ getValue }) => (
      //     <div className="w-full p-2 text-center">{getValue()}</div>
      //   ),
      // }),
      column.accessor("email", {
        header: "Email",
        cell: ({ getValue, row }) => (
          <TextFieldCell
            value={getValue() ?? ""}
            updateData={(value) =>
              handleUpdateRow(row.index, {
                id: row.original.id,
                email: value ? value : null,
              })
            }
            isDirty={updates.get(row.original.id)?.email !== undefined}
          />
        ),
      }),
      column.accessor("roles", {
        id: "role",
        header: "Rollen",
        cell: ({ getValue }) => (
          <div className="w-full p-2">
            {getValue()
              .map((role) => role.name)
              .join(", ")}
          </div>
        ),
      }),
      column.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => <Status user={row.original} />,
      }),
      column.display({
        id: "actions",
        header: "Aktionen",
        cell: ({ row }) => (
          <Actions
            user={row.original}
            onClickChangePassword={onClickChangePassword}
            onClickPermissions={onClickPermissions}
            onClickDelete={onClickDelete}
          />
        ),
      }),
    ],
    [
      handleUpdateRow,
      onClickChangePassword,
      onClickDelete,
      onClickPermissions,
      updates,
    ],
  );

  const table = useReactTable({
    columns,
    data: users,
    autoResetPageIndex,
    getCoreRowModel: getCoreRowModel<User>(),
  });

  return (
    <div
      className="grid w-full"
      style={{
        gridTemplateColumns: "1fr min-content min-content min-content",
        gap: "1px",
      }}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <Fragment key={headerGroup.id}>
          {headerGroup.headers.map((header) => (
            <div
              key={header.id}
              className="px-2 py-4 outline outline-1 outline-grey-100"
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
            </div>
          ))}
        </Fragment>
      ))}
      {table.getRowModel().rows.map((row) => (
        <Fragment key={row.id}>
          {row.getVisibleCells().map((cell) => (
            <div
              key={cell.id}
              className="flex items-center outline outline-1 outline-grey-100"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
};
