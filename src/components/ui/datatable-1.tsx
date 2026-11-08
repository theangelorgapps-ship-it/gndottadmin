"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { usersData } from "@/components/ui/datatable-1-utils/datatable-1-data";
import { Datatable1Pagination } from "@/components/ui/datatable-1-utils/datatable-1-pagination";
import { Datatable1Toolbar } from "@/components/ui/datatable-1-utils/datatable-1-toolbar";

const ITEMS_PER_PAGE = 6;

const HEAD_CLASS =
  "p-4 font-medium text-sm text-muted-foreground uppercase tracking-wider";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function Datatable1() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const currentUsers = usersData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const allSelected =
    selectedUsers.length === currentUsers.length && currentUsers.length > 0;

  const toggleAllUsers = () => {
    setSelectedUsers(allSelected ? [] : currentUsers.map((user) => user.id));
  };

  return (
    <div className="w-full max-w-7xl flex flex-col gap-6 my-8 mx-auto px-4 sm:px-6 lg:px-8">
      <Card className="pb-0 gap-0">
        <CardHeader className="border-b border-border gap-0">
          <Datatable1Toolbar />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="p-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAllUsers}
                    aria-label="Select all users"
                  />
                </TableHead>
                <TableHead className={HEAD_CLASS}>User</TableHead>
                <TableHead className={HEAD_CLASS}>Role</TableHead>
                <TableHead className={HEAD_CLASS}>Last Login</TableHead>
                <TableHead className={HEAD_CLASS}>Two-Step</TableHead>
                <TableHead className={HEAD_CLASS}>Joined Date</TableHead>
                <TableHead className={HEAD_CLASS}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell className="p-4">
                    <Checkbox
                      checked={selectedUsers.includes(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      aria-label={`Select ${user.name}`}
                    />
                  </TableCell>
                  <TableCell className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 bg-muted">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-foreground">
                          {user.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {user.role}
                  </TableCell>
                  <TableCell className="p-4 text-sm font-medium text-foreground">
                    {user.lastLogin}
                  </TableCell>
                  <TableCell className="p-4 text-center">
                    {user.twoStep ? (
                      <Badge
                        variant="outline"
                        className="px-2.5 py-0.5 font-semibold bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                      >
                        Enabled
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {user.joinedDate}
                  </TableCell>
                  <TableCell className="p-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs cursor-pointer"
                        >
                          Actions
                          <ChevronDown data-icon="inline-end" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem className="cursor-pointer py-2">
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer py-2">
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive cursor-pointer py-2">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Datatable1Pagination
            page={currentPage}
            pageSize={ITEMS_PER_PAGE}
            total={usersData.length}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Datatable1;
