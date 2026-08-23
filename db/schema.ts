import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  ownerEmail: text("owner_email").primaryKey(),
  tasksJson: text("tasks_json").notNull(),
  passwordJson: text("password_json"),
  revision: integer("revision").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});
