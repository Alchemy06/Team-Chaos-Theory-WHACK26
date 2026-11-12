import assert from "node:assert/strict";
import { test } from "node:test";
import { appHarness } from "./helpers/appHarness.mjs";

test("Re-explore evidence stays in the dream's city", async (t) => {
  const h = await appHarness(); t.after(h.close);
  const db = h.load("lib/db.ts");
  const otherCity = (await h.pg.query("insert into cities(name) values('Other city') returning id")).rows[0].id;
  const own = await db.createSession(), other = await db.createSession(otherCity);
  const build = (id) => ({ journalID: id, mainEmotion: "apprehension", secondaryEmotion: null, buildHeight: 6, hoverDesc: "Water in a house", themes: ["home"], description: "A house flooded with water.", microEmotion: "anxiety", symbols: ["water", "house"], newSymbols: [], places: ["house"], emotionStated: true, hvdcEmotion: "apprehension", intensitySource: "self", mentionedWorks: [], typicalDreams: [] });
  for (const session of [own, other]) {
    await db.addMessage(session.id, "user", session.id === own.id ? "Water filled my house." : "PRIVATE OTHER CITY DREAM", null, 0);
    await db.completeSession(session.id, "# Saved journal"); await db.upsertBuildData(build(session.id));
  }
  await h.pg.query("insert into media(kind,title,main_emotion,city_id,symbols) values('book','Own book','apprehension',null,ARRAY['water']),('book','PRIVATE OTHER CITY BOOK','apprehension',$1,ARRAY['water'])", [otherCity]);
  const context = await h.load("lib/reexploreContext.ts").reexploreContext(await db.getSession(own.id), build(own.id));
  assert.equal(context.dreams.length, 1); assert.equal(context.dreams[0].id, own.id);
  assert.equal(context.works.length, 1); assert.equal(context.works[0].title, "Own book");
  assert.ok(!JSON.stringify(context).includes("PRIVATE OTHER CITY"));
});
