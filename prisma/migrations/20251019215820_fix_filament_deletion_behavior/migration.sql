-- DropForeignKey
ALTER TABLE "public"."slice_filaments" DROP CONSTRAINT "slice_filaments_filament_id_fkey";

-- AlterTable
ALTER TABLE "slice_filaments" ALTER COLUMN "filament_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "slice_filaments" ADD CONSTRAINT "slice_filaments_filament_id_fkey" FOREIGN KEY ("filament_id") REFERENCES "filaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
