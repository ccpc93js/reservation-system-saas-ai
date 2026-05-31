import { createServerClient } from "@/lib/supabase/server";
import RoomTypesListClient from "@/components/rooms/room-types-list-client";
import RoomsListClient from "@/components/rooms/rooms-list-client";
import BedsListClient from "@/components/beds/beds-list-client";
import { ChevronDown } from "lucide-react";

type Membership = { organization_id: string };

export default async function RoomsPage() {
  const supabase = await createServerClient();

  // Get current user's organization
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return <div className="text-sm text-muted-foreground">Unauthorized</div>;
  }

  const { data: membershipRaw } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  const membership = membershipRaw as Membership | null;

  if (!membership) {
    return <div className="text-sm text-muted-foreground">No organization found</div>;
  }

  // Fetch room types
  const { data: roomTypes = [], count: roomTypesTotal = 0 } = await supabase
    .from("room_types")
    .select("*", { count: "exact" })
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(25);

  // Fetch rooms
  const { data: rooms = [], count: roomsTotal = 0 } = await supabase
    .from("rooms")
    .select("*, room_types(id, name, type, capacity, base_price)", { count: "exact" })
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(25);

  // Fetch beds
  const { data: beds = [], count: bedsTotal = 0 } = await supabase
    .from("beds")
    .select("*, rooms(id, name, floor, room_types(name, type))", { count: "exact" })
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(25);

  const roomTypesCount = roomTypesTotal ?? 0;
  const roomsCount = roomsTotal ?? 0;
  const bedsCount = bedsTotal ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Room Inventory</h1>
        <p className="text-sm mt-0.5 text-muted-foreground">
          Manage room types, rooms, and beds for your organization
        </p>
      </div>

      {/* Room Types Section */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/70">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Room Types</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {roomTypesCount} room type{roomTypesCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronDown className="h-5 w-5 transition-transform" />
        </button>
        <div className="px-4 py-4">
          <RoomTypesListClient
            initialRoomTypes={roomTypes as any}
            initialTotal={roomTypesCount}
          />
        </div>
      </div>

      {/* Rooms Section */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/70">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Rooms</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {roomsCount} room{roomsCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronDown className="h-5 w-5 transition-transform" />
        </button>
        <div className="px-4 py-4">
          <RoomsListClient
            initialRooms={rooms as any}
            initialTotal={roomsCount}
          />
        </div>
      </div>

      {/* Beds Section */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/70">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Beds</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {bedsCount} bed{bedsCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronDown className="h-5 w-5 transition-transform" />
        </button>
        <div className="px-4 py-4">
          <BedsListClient
            initialBeds={beds as any}
            initialTotal={bedsCount}
          />
        </div>
      </div>
    </div>
  );
}
