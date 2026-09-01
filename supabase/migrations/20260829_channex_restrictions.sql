alter table public.room_types
  add column stop_sell boolean not null default false,
  add column min_stay_arrival integer check (min_stay_arrival is null or min_stay_arrival > 0),
  add column min_stay_through integer check (min_stay_through is null or min_stay_through > 0),
  add column closed_to_arrival boolean not null default false,
  add column closed_to_departure boolean not null default false;

comment on column public.room_types.stop_sell is 'Channex ARI: manual override to stop selling this room type on all connected channels.';
comment on column public.room_types.min_stay_arrival is 'Channex ARI: minimum nights required when arriving on a given date. Null = no restriction.';
comment on column public.room_types.min_stay_through is 'Channex ARI: minimum nights required to stay through a given date. Null = no restriction.';
comment on column public.room_types.closed_to_arrival is 'Channex ARI: manual override closing this room type to new arrivals.';
comment on column public.room_types.closed_to_departure is 'Channex ARI: manual override closing this room type to departures.';
