-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "autonomyLevel" TEXT NOT NULL DEFAULT 'medium',
    "budget" REAL,
    "budgetUsed" REAL NOT NULL DEFAULT 0,
    "budgetPeriod" TEXT NOT NULL DEFAULT 'monthly',
    "externalUrl" TEXT,
    "lastScannedAt" DATETIME,
    "scanInterval" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("autonomyLevel", "budget", "budgetPeriod", "budgetUsed", "category", "createdAt", "description", "icon", "id", "name", "status", "userId") SELECT "autonomyLevel", "budget", "budgetPeriod", "budgetUsed", "category", "createdAt", "description", "icon", "id", "name", "status", "userId" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
