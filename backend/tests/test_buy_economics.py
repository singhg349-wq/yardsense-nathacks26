"""A purchase is judged on one extra unit's own 12-month demand, like the fleet advisor."""
import pytest

from yardsense import allocator, api, cost_model, db, fleet_advisor

TODAY = "2027-01-04"

# Outside rental 1,000 per 28-day month; owning costs 10,000 x 10% + 12 x 100 = 2,200 a year.
RATES = {
    "label": "Test unit",
    "outside": {"day": 100, "week": 400, "month": 1000},
    "outside_delivery_fee": 50,
    "internal": {"day": 90, "week": 360, "month": 900},
    "purchase_price": 10000,
    "resale_pct_per_year": 0.10,
    "maintenance_month": 60,
    "insurance_month": 40,
    "wear_per_day": 1,
}
OWN = 2200


def world(needs):
    """One unit T1, busy all year on ongoing project PRJ-C, plus new needs on sites A and B."""
    return {
        "settings": {"demo_today": TODAY, "horizon_months": 12, "max_breakeven_months": 6,
                     "road_factor": 1.3, "truck_cost_per_km": 4.5, "truck_base_fee": 150},
        "classes": {"TEST": RATES},
        "companies": [{"code": "NR01", "name": "Northgate Rentals", "kind": "rental"}],
        "sites": [{"id": "Y-NR", "name": "Rentals yard", "kind": "yard", "company": "NR01",
                   "lat": 53.5, "lon": -113.5},
                  {"id": "S-A", "name": "Site A", "kind": "site", "company": "NR01",
                   "lat": 53.55, "lon": -113.45},
                  {"id": "S-B", "name": "Site B", "kind": "site", "company": "NR01",
                   "lat": 53.6, "lon": -113.4},
                  {"id": "S-C", "name": "Site C", "kind": "site", "company": "NR01",
                   "lat": 53.52, "lon": -113.52}],
        "assets": [{"asset_id": "T1", "asset_class": "TEST", "company": "NR01"}],
        "assignments": [{"id": 1, "asset_id": "T1", "project_id": "PRJ-C", "site_id": "S-C",
                         "checked_out": "2026-12-01", "checked_in": None}],
        "projects": [
            {"id": "PRJ-C", "site_id": "S-C", "planned_equipment": [
                {"class": "TEST", "qty": 1, "start": "2026-12-01", "finish": "2027-12-31"}]},
            *({"id": project_id, "site_id": site_id, "planned_equipment": [
                {"class": "TEST", "qty": 1, "start": start, "finish": finish}]}
              for project_id, site_id, start, finish in needs)],
    }


def row(plan, project_id):
    return next(r for r in plan if r["project_id"] == project_id)


def buy_of(r):
    return next(option for option in r["options"] if option["option"] == "buy")


def test_buy_only_when_the_extra_unit_nets_positive_and_the_advisor_agrees():
    # T1 is busy all year. A needs one more unit for 168 days, B for 28 days.
    #   Extra unit 1 covers A's 168 days (and B's overlap, 28 days, needs a 2nd).
    #   Unit 1: 6 x 1,000 + 50 = 6,050 rent avoided - 2,200 = +3,850/yr -> buy.
    #   Unit 2 (for B): 1,000 + 50 = 1,050 - 2,200 = -1,150/yr -> rent outside.
    w = world([("PRJ-A", "S-A", "2027-01-04", "2027-06-20"),
               ("PRJ-B", "S-B", "2027-01-04", "2027-01-31")])
    plan = allocator.build_plan(w)
    a, b = row(plan, "PRJ-A"), row(plan, "PRJ-B")
    assert a["option"] == "buy"
    buy = buy_of(a)
    assert buy["available"] and buy["net_annual_impact"] == 3850
    assert buy["breakeven_month"] == 32  # 10,000 / (3,850 / 12) = 31.2
    assert b["option"] == "rent_outside"
    assert not buy_of(b)["available"] and buy_of(b)["net_annual_impact"] == -1150

    item = {i["class"]: i for i in fleet_advisor.advise(w, plan)["items"]}["TEST"]
    assert item["action"] == "add" and item["quantity"] == 1
    assert item["plan_purchases"] == 1
    assert item["next_unit"]["net_annual_impact"] == buy["net_annual_impact"]
    assert item["breakeven_month"] == buy["breakeven_month"]


def test_a_bought_unit_costs_the_plan_one_full_year_to_own():
    # The extra unit serves A (168 days) and then B (153 days) at another site.
    w = world([("PRJ-A", "S-A", "2027-01-04", "2027-06-20"),
               ("PRJ-B", "S-B", "2027-07-01", "2027-11-30")])
    plan = allocator.build_plan(w)
    a, b = row(plan, "PRJ-A"), row(plan, "PRJ-B")
    assert a["option"] == "buy"
    quoted = buy_of(a)
    # Quote: A's 168 of the unit's 321 planned days; the rest is shown, not hidden.
    assert quoted["group_cost"] == pytest.approx(OWN * 168 / 321, abs=0.01)
    assert quoted["owning_remainder"] == pytest.approx(OWN * 153 / 321, abs=0.01)
    assert quoted["group_cost"] + quoted["owning_remainder"] == pytest.approx(OWN, abs=0.01)
    # B reuses the bought unit, trucked from the site A booking, and pays its share.
    assert b["option"] == "rent_sister"
    assert b["asset_ids"] == a["asset_ids"]
    assert b["moves"][0]["from_site_id"] == "S-A" and b["moves"][0]["to_site_id"] == "S-B"
    charges = [c for r in plan for c in r.get("owning_charges", [])]
    assert sum(c["amount"] for c in charges) == pytest.approx(OWN, abs=0.01)
    truck_and_wear = next(o for o in b["options"] if o["option"] == "rent_sister")
    assert b["group_cost"] == pytest.approx(
        truck_and_wear["group_cost"] + OWN * 153 / 321, abs=0.02)


def test_an_unused_purchase_is_charged_in_full_to_the_buyer():
    w = world([("PRJ-A", "S-A", "2027-01-04", "2027-06-20")])
    plan = allocator.build_plan(w)
    a = row(plan, "PRJ-A")
    assert a["option"] == "buy"
    assert a["group_cost"] == pytest.approx(OWN, abs=0.01)
    assert a["units"][0]["group_cost"] == pytest.approx(OWN, abs=0.01)


def test_seed_generator_engine_and_advisor_agree():
    w = db.load_world()
    plan = allocator.build_plan(w)
    generator = {i["class"]: i for i in fleet_advisor.advise(w, plan)["items"]}["GEN_45KW"]
    riverside = next(r for r in plan if r["request_id"] == "PRJ-RIV:2")
    buy = buy_of(riverside)
    assert generator["action"] != "add" and generator["plan_purchases"] == 0
    assert buy["available"] is False and riverside["option"] == "rent_outside"
    # Both use the same marginal unit: 308 days, $10,050 avoided, $13,800 to own.
    assert buy["marginal_units"][0] == generator["next_unit"]
    assert buy["net_annual_impact"] == generator["next_unit"]["net_annual_impact"] == -3750


def test_seed_plan_never_buys_a_unit_the_advisor_says_loses_money():
    w = db.load_world()
    plan = allocator.build_plan(w)
    advice = {i["class"]: i for i in fleet_advisor.advise(w, plan)["items"]}
    for item in advice.values():
        if item["plan_purchases"]:
            assert item["action"] == "add"
            assert item["plan_purchases"] <= len(
                [u for u in item["marginal_units"] if u["net_annual_impact"] > 0])


def test_buy_option_exposes_the_owning_split():
    w = db.load_world()
    body = {"project_id": "PRJ-RIV", "items": [
        {"class": "GEN_45KW", "qty": 1, "start": "2026-11-23", "finish": "2027-01-31"}]}
    options = api.recommend(w, body)["items"][0]["options"]
    buy = next(o for o in options if o["option"] == "buy")
    share, rest = buy["group_breakdown"]
    assert share["label"].startswith("This need's share of 1 x $13,800/yr to own (70 of 308")
    assert rest["label"].startswith("Not in this cost")
    assert share["amount"] == buy["group_cost"]
    assert buy["owning_cost"] == cost_model.cost_to_own(w["classes"]["GEN_45KW"])
    assert sum(line["amount"] for line in buy["group_breakdown"]) == pytest.approx(
        buy["owning_cost"], abs=0.01)
