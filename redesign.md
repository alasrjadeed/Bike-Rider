# BIKE RIDER — Motorcycle, Rider & Helmet Redesign

## Status

**Design proposal for review only.** No game code, assets, balance, or save data have been changed. Review and
approve the visual direction before implementation.

## Goal

Give the player bike, rider, and helmet a coherent, memorable identity that feels at home in Bike Rider:
an everyday Gulf delivery commuter, made distinctive by its practical details and the rider's own company style.
Keep the existing painted-heat art direction—procedural, low-poly, vertex-coloured, readable at speed—and improve
the forms rather than making them photorealistic or replacing the compact motorcycle with a different class.

## Visual direction

**GAUSS AUTO city-commuter, refined for the working rider.** The bike should feel dependable, maintained, and
used every day: compact underbone proportions, a clearly readable silhouette, purposeful cargo carrying, and a
few polished metal details catching the dusk and street lighting. Bahrain red remains the free starting identity;
the player's chosen paint and company branding remain the personal accents.

At a glance, the three subjects should read in this order:

1. **Bike:** small working commuter with two clearly separated wheels, a practical seat, and delivery-ready rack.
2. **Rider:** alert, forward-facing courier in a recognisable riding posture and fitted workwear.
3. **Helmet:** a distinct shell silhouette and visor treatment, not just a colour change.

Keep the shapes bold enough to read in the gameplay camera. Fine detail should reward the showroom close-up, not
be required to identify the bike during a shift.

## 1. Motorcycle

### Shape and parts

- Refine the existing compact commuter silhouette in place; do not lengthen the wheelbase or raise the seat as
  part of this pass.
- Give the front cowl, headlamp surround, tank, side covers, seat, and mudguards clearer, connected forms so
  the bike reads as one designed machine rather than a collection of unrelated blocks.
- Make the seat visibly stepped for rider and passenger, with a practical passenger grab rail and foot pegs.
- Make the rear carrier and cargo-box mount look load-bearing. Keep the delivery box readable and unobstructed
  when a job cargo item is fitted.
- Clarify the engine, exhaust, chain/drive side, fork, brakes, and wheel rims with restrained dark metal and
  warm chrome highlights. Keep tyre tread and spoke/rim detail legible without visual noise.
- Use restrained, functional headlamp and indicator shapes. Lighting effects stay in the player-bike assembly;
  baked traffic models use geometry only.
- Use the body paint on the tank/cowl/side covers and retain dark rubber, frame, and engine parts for contrast.
  Decals and company colours should complement, not hide, the bike's silhouette.

### Bike catalogue

Apply the same design language across the existing GAUSS AUTO catalogue. Preserve each bike's current identity
through its frame family, tank/seat/rack proportions, wheel type, paint, and existing progression role. Entry
models should remain modest workhorses; later models may look cleaner, wider, or more premium without becoming
unrecognisable as practical commuters.

This proposal does **not** add bike models, change names, prices, unlocks, handling, speed, gears, or economy.

## 2. Player rider

- Replace the blocky mannequin impression with clearer shoulder, torso, waist, thigh, knee, and boot proportions,
  while retaining the existing seated riding pose and limb attachment points.
- Give the player rider a practical courier outfit: shaped jacket or uniform top, durable trousers, gloves, and
  ankle-covering boots. Details should be subtle and remain readable at gameplay distance.
- Keep the pose relaxed but attentive: hands on the grips, knees aligned with the bike, feet at the pegs, and
  torso leaning slightly forward. The rider should still fit the current bike and pillion arrangement.
- Preserve the chosen outfit, company uniform, company badge, name tag, and colour behaviour. Do not draw a cap
  over a fitted helmet.
- Scope added clothing detail to the **player rider**. Pedestrians, staff, traffic riders, and the passenger
  keep their lighter existing rigs unless separately approved.

## 3. Helmet collection

Keep the four existing shape families and give each a strong side-profile difference. The collection's helmet
items may reuse these families; colour, fictional maker markings, and trim distinguish individual items.

| Shape family | Proposed look | Silhouette cue |
|---|---|---|
| Half shell | Compact open shell, short peak, visible strap | Low dome and open face |
| Open face | Fuller rounded shell, small visor peak, slim chin bar | Broader bowl with exposed face |
| Full face | Enclosed chin guard, dark visor, small vents | Continuous face-covering shell |
| Modular premium | Full shell with a distinct hinge/jaw section, visor edge, and short rear aero tail | Layered jaw and rear profile |

Use a contrasting visor and a small number of vents, seams, or trim marks so the forms remain visible at night.
Place all details on the outside of the shell; do not hide decoration inside solid helmet geometry. Keep the face
covered or visible according to the selected family, and do not add real-world helmet brands or logos.

**Protection and appearance stay separate.** The helmet's visual style remains a cosmetic choice; purchased
helmet protection remains its existing gameplay upgrade. Showroom tier previews are visual-only and must never
equip a helmet, grant protection, or change the save.

## 4. Showroom presentation

- Use the existing GAUSS AUTO turntable as the review surface; keep the bike unobstructed by the information
  panel and preserve the current bike-selection and purchase flow.
- The standard view should show the complete bike in a clear three-quarter view with the rider available as a
  toggle.
- Helmet inspection should bring the rider's head into a clear close-up, show the selected helmet shape and
  colour, and return cleanly to the standard bike view on exit.
- Check the same design at the supported landscape phone size as well as desktop. Keep controls and model
  visible together; do not solve visibility by making the sidebar cover more of the bike.

## Implementation constraints for a later pass

- Keep `index.html` as the sole game-code source; retain procedural geometry and existing vertex-colour
  materials. No downloaded models, textures, fonts, or other external assets.
- Preserve the current bike wheelbase, steering head, wheel mounts, grips, and rider/pillion pose anchors unless
  a separately reviewed change explicitly includes re-tuning all dependent poses.
- Preserve both bike build paths: player bike and baked traffic/depot geometry. Bike builders must remain
  compatible with the smaller options object used by NPCs (including an absent headlight-upgrade value).
- Keep paintable body panels on the paint-material path; keep frame, engine, and other fixed-metal parts on the
  existing fixed-material path.
- Keep fine geometry modest and quality-aware. The low-quality path and NPCs should not pay for showroom-only
  detail; do not add per-frame geometry/material creation or bypass existing geometry caches.
- Preserve the existing bike catalogue, outfit/company customisation, passenger rig, cargo mounting, helmet
  preview/equip separation, and save schema.
- Retain the fictional GAUSS AUTO and helmet maker names; do not introduce real trademarks.

## Review checklist

- Does the compact working-commuter direction fit the intended Bike Rider identity?
- Are the proposed bike details practical and distinct without becoming visually busy?
- Does the rider read clearly at gameplay distance and remain compatible with all outfits and company colours?
- Can the four helmet families be distinguished in side view and in the showroom close-up?
- Is player-only rider detailing and quality-gated fine detail the right performance trade-off?

Once this direction is approved, implementation can be split into bike geometry, player rider, helmet/showroom,
and visual/performance verification passes. Until then, this file is the design reference; it does not authorize
changes to the playable game.
