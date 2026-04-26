-- PR Forge estimated max correction
-- If percentage_of_max exists, estimated_1rm_kg should be normalized_weight_kg / (percentage / 100).
-- Otherwise, keep the rep-based estimate.

update public.lift_entries
set estimated_1rm_kg = case
  when percentage_of_max is not null and percentage_of_max > 0
    then normalized_weight_kg / (percentage_of_max / 100)
  else normalized_weight_kg * (1 + reps::numeric / 30)
end;

