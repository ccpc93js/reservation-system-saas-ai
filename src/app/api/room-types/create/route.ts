import { createServerClient } from "@/lib/supabase/server";
import { createRoomTypeSchema } from "@/lib/validations/room";
import { getPrimaryMembership } from "@/lib/org-membership";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await getPrimaryMembership(supabase, user.id);
    if (!membership) {
      return Response.json(
        { error: "You don't have access to any organization" },
        { status: 403 }
      );
    }

    const body = await request.json();

    try {
      await createRoomTypeSchema.validate(body);
    } catch (validationError: any) {
      return Response.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    const { data: newRoomType, error: roomTypeError } = await (supabase
      .from("room_types") as any)
      .insert({
        organization_id: membership.organizationId,
        name: body.name,
        type: body.type,
        gender: body.gender || null,
        capacity: body.capacity,
        base_price: body.base_price,
        description: body.description || null,
        stop_sell: body.stop_sell ?? false,
        closed_to_arrival: body.closed_to_arrival ?? false,
        closed_to_departure: body.closed_to_departure ?? false,
        min_stay_arrival: body.min_stay_arrival ?? null,
        min_stay_through: body.min_stay_through ?? null,
        max_stay: body.max_stay ?? null,
      })
      .select("id")
      .single();

    if (roomTypeError) {
      console.error("Room type creation error:", roomTypeError);
      return Response.json(
        { error: "Failed to create room type" },
        { status: 400 }
      );
    }

    const roomTypeId = (newRoomType as any).id;

    const { error: ratePlanError } = await (supabase.from("rate_plans") as any).insert({
      organization_id: membership.organizationId,
      room_type_id: roomTypeId,
      name: "Standard Rate",
      base_price: body.base_price,
      stop_sell: body.stop_sell ?? false,
      closed_to_arrival: body.closed_to_arrival ?? false,
      closed_to_departure: body.closed_to_departure ?? false,
      min_stay_arrival: body.min_stay_arrival ?? null,
      min_stay_through: body.min_stay_through ?? null,
      max_stay: body.max_stay ?? null,
      is_default: true,
    });
    if (ratePlanError) {
      console.error("Default rate plan creation error:", ratePlanError);
      // Room type was created; surface this but don't fail the whole
      // request. Today this leaves the room type with zero rate plans and
      // no in-app way to notice or fix it short of direct DB access — the
      // room-type dialog doesn't yet show or manage a rate-plans list.
      // That recovery UI is a later task; until it ships, treat this log
      // line as the only signal.
    }

    return Response.json(
      { success: true, room_type_id: roomTypeId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating room type:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
