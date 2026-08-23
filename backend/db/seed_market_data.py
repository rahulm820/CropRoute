"""Market demo data: mandis, prices, news, fertilizer prices, crop knowledge.

The Bright Data collectors are not provisioned yet (placeholder c_TBD ids), so
the demo runs on this seed until live collection starts - CLAUDE.md rule 3:
"the demo path must work on seeded data even if a live scrape is slow".

Run: python -m db.seed_market_data   (idempotent - safe to re-run)

Every sourced row carries source_url + scraped_at/published_at provenance;
news URLs point at the publishers the news collectors watch, never gov portals.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from db.session import SessionLocal
from models import (
    Commodity,
    CropKnowledge,
    FertilizerPrice,
    Mandi,
    News,
    Price,
    State,
)

D = lambda x: date(2026, 8, x)
NOW = datetime.now(timezone.utc)
H = lambda h: NOW - timedelta(hours=h)
DT = lambda y, m, d: datetime(y, m, d, 10, 0, tzinfo=timezone.utc)


# name, (lat, lng)
NEW_MANDIS = {
    "Punjab": [
        ("Amritsar", 31.63, 74.87),
        ("Bathinda", 30.21, 74.94),
        ("Jagraon", 30.79, 75.47),
        ("Moga", 30.80, 75.17),
        ("Patiala", 30.34, 76.38),
    ],
    "Gujarat": [
        ("Rajkot", 22.30, 70.80),
        ("Jamnagar", 22.47, 70.06),
        ("Gondal", 21.94, 70.80),
        ("Junagadh", 21.52, 70.46),
        ("Bharuch", 21.71, 72.99),
    ],
}

# (state, mandi, commodity, [(date, modal, min, max, arrivals_tonnes)])
def _price_series(base, drift):
    """Three points over the last week so trend_7d_pct has something to show."""
    return [
        (D(16), base - drift, base - drift - 60, base - drift + 70, 320),
        (D(19), base, base - 55, base + 65, 410),
        (D(23), base + drift, base + drift - 60, base + drift + 70, 480),
    ]

PRICES = []
for m in ["Khanna", "Ludhiana", "Amritsar", "Bathinda", "Jagraon", "Moga", "Patiala"]:
    PRICES.append(("Punjab", m, "Wheat", _price_series(2380, 35)))
for m in ["Amritsar", "Bathinda", "Moga", "Patiala", "Jagraon", "Khanna"]:
    PRICES.append(("Punjab", m, "Rice", _price_series(3950, 45)))
for m in ["Rajkot", "Jamnagar", "Gondal", "Junagadh", "Bharuch"]:
    PRICES.append(("Gujarat", m, "Cotton", _price_series(7250, 60)))
for m in ["Junagadh", "Rajkot", "Jamnagar", "Gondal"]:
    PRICES.append(("Gujarat", m, "Groundnut", _price_series(5950, 50)))

NEWS = [
    # Real, verifiable articles only - every URL was confirmed live via web
    # search before seeding. A dead link looks more fabricated than an empty
    # section, so unverifiable stories are left out entirely.
    # ---- Punjab ----
    dict(state="Punjab",
         title="Punjab farmers advised to wrap up paddy transplantation",
         summary=("AMFU Ludhiana asked farmers in Patiala, Fatehgarh Sahib, Amritsar, "
                  "Tarn Taran, Kapurthala, Jalandhar and Ludhiana to finish PR-126 "
                  "transplanting within days while weather stays favourable."),
         url="https://www.tribuneindia.com/news/patiala/punjab-farmers-advised-to-wrap-up-paddy-transplantation",
         publisher="The Tribune", published=DT(2026, 7, 13),
         collector="punjab_agri_news_tribune"),
    dict(state="Punjab",
         title="Punjab wheat procurement 2026: Govt buying rises as private trade falls",
         summary=("Mandi arrivals fell about 6% year-on-year, yet agencies procured "
                  "almost the entire market - private trade participation collapsed "
                  "86% and Sangrur led districts with 9.09 lakh MT."),
         url="https://indianexpress.com/article/cities/chandigarh/punjab-wheat-procurement-2026-lower-arrivals-higher-state-buying-a-data-driven-comparison-with-2025-10680989",
         publisher="Indian Express", published=DT(2026, 5, 9),
         collector="punjab_agri_news_indianexpress"),
    dict(state="Punjab",
         title="Video: Paddy procurement delay - farmers protest as mandi fails to lift crop",
         summary=("Farmers staged protests after paddy lying in the mandi was not "
                  "lifted on schedule, pressing officials to speed up procurement "
                  "movements out of the grain markets."),
         url="https://www.youtube.com/watch?v=4_r0vJrbmfs",
         video_url="https://www.youtube.com/watch?v=4_r0vJrbmfs",
         publisher="YouTube", published=None,
         collector="punjab_agri_news_video"),
    # ---- Gujarat ----
    dict(state="Gujarat",
         title="Amreli APMC tops cotton with Rs 9,600 per quintal rate",
         summary=("The Agricultural Produce Market Committee at Amreli recorded the "
                  "highest traded cotton rate of the session, setting the benchmark "
                  "for Saurashtra kapas trade."),
         url="https://mandipulse.com/mandi-update/cotton/top-mandi/the-agricultural-produce-market-committee-amreli/2026-08-20",
         publisher="MandiPulse", published=DT(2026, 8, 20),
         collector="gujarat_agri_news_mandipulse"),
    dict(state="Gujarat",
         title="Saurashtra kharif sowing crosses 60%: groundnut, cotton lead",
         summary=("Official data put kharif sowing above 60% across Rajkot, Jamnagar, "
                  "Junagadh, Amreli and Bhavnagar, with record groundnut acreage in "
                  "Rajkot and Jamnagar and cotton preferred in Amreli."),
         url="https://gujarati.oneindia.com/agriculture/saurashtra-kharif-crop-sowing-record-groundnut-cotton-2026-495747.html",
         publisher="Oneindia Gujarati", published=DT(2026, 6, 28),
         collector="gujarat_agri_news_oneindia"),
    dict(state="Gujarat",
         title="Delayed monsoon slows groundnut and cotton sowing in Gujarat",
         summary=("Farmers with borewells kept sowing groundnut while others waited "
                  "for rain; groundnut and cotton cultivation is concentrated in "
                  "Saurashtra and parts of north Gujarat."),
         url="https://textilevaluechain.in/delayed-monsoon-slows-groundnut-and-cotton-sowing-in-gujarat",
         publisher="Textile Value Chain", published=DT(2026, 7, 4),
         collector="gujarat_agri_news_tvc"),
]

FERTILIZER_PRODUCTS = [
    ("Urea", "266.50", "45 kg bag", "5.92"),
    ("DAP", "1350.00", "50 kg bag", "27.00"),
    ("MOP", "1700.00", "50 kg bag", "34.00"),
    ("NPK 12:32:16", "1330.00", "50 kg bag", "26.60"),
    ("SSP", "550.00", "50 kg bag", "11.00"),
]
FERT_STATES = ["Punjab", "Gujarat", "Haryana", "Madhya Pradesh"]

KNOWLEDGE = [
    dict(state="Punjab", commodity="Wheat",
         sowing="Nov 1 – Nov 25", harvest="Apr 15 – May 10",
         districts=["Ludhiana", "Sangrur", "Barnala", "Patiala", "Bathinda"],
         notes="Late-sown crops lose yield fast - aim to finish by Nov 25. Zero-till drills cut field prep cost and save irrigation water. Watch for yellow rust reports in sub-mountain belts."),
    dict(state="Punjab", commodity="Rice",
         sowing="Jun 10 – Jun 30 (nursery); transplant July", harvest="Sep 25 – Oct 20",
         districts=["Amritsar", "Tarn Taran", "Patiala", "Ludhiana"],
         notes="Short-duration varieties like PR 121/PR 126 free the window for timely wheat sowing and cut stubble load. Alternate wetting-drying saves water without yield loss."),
    dict(state="Gujarat", commodity="Cotton",
         sowing="May 15 – Jun 30 with monsoon onset", harvest="Oct – Jan (2–3 pickings)",
         districts=["Rajkot", "Jamnagar", "Junagadh", "Bharuch", "Morbi"],
         notes="Bt hybrids dominate Saurashtra. Scout weekly for pink bollworm from square formation; destroy stubbles after last picking to break the pest cycle."),
    dict(state="Gujarat", commodity="Groundnut",
         sowing="Jun 20 – Jul 15", harvest="Oct 1 – Nov 5",
         districts=["Junagadh", "Rajkot", "Jamnagar", "Gondal"],
         notes="Apply gypsum at pegging stage on light soils. Bold-seeded bunch types fetch a crushing premium - grade before taking lots to market."),
    dict(state="Haryana", commodity="Wheat",
         sowing="Nov 5 – Nov 30", harvest="Apr 10 – May 5",
         districts=["Karnal", "Kurukshetra", "Panipat", "Hisar"],
         notes="Rice-wheat rotation areas should schedule last paddy irrigation so fields are ready for timely wheat drilling. Seed treatment controls loose smut."),
]


def get_ids(db, model, name_field, names):
    rows = db.execute(select(model.id, getattr(model, name_field))).all()
    lut = {n: i for i, n in rows}
    missing = set(names) - set(lut)
    if missing:
        raise SystemExit(f"unknown {model.__tablename__}: {sorted(missing)}")
    return lut


def main():
    db = SessionLocal()
    try:
        state_id = get_ids(db, State, "name", list(NEW_MANDIS) + FERT_STATES
                           + [n["state"] for n in NEWS] + [k["state"] for k in KNOWLEDGE])
        comm_id = get_ids(db, Commodity, "name",
                          sorted({p[2] for p in PRICES} | {k["commodity"] for k in KNOWLEDGE}))

        # ---- mandis -------------------------------------------------------
        for st, mandis in NEW_MANDIS.items():
            sid = state_id[st]
            for name, lat, lng in mandis:
                db.execute(
                    insert(Mandi).values(state_id=sid, name=name, lat=lat, lng=lng)
                    .on_conflict_do_nothing(constraint="uq_mandi_state_name")
                )
        db.flush()

        mandi_id = {}
        for st in NEW_MANDIS:
            sid = state_id[st]
            for m in db.scalars(select(Mandi).where(Mandi.state_id == sid)):
                mandi_id[(st, m.name)] = m.id
        # mandis already outside NEW_MANDIS (Khanna, Ludhiana...)
        for m in db.scalars(select(Mandi).where(Mandi.state_id.in_(list(state_id.values())))):
            mandi_id.setdefault((db.get(State, m.state_id).name, m.name), m.id)

        # ---- prices -------------------------------------------------------
        for st, mn, co, series in PRICES:
            mid, cid = mandi_id[(st, mn)], comm_id[co]
            for d, modal, lo, hi, arr in series:
                db.execute(
                    insert(Price).values(commodity_id=cid, mandi_id=mid, date=d,
                                         modal_price=modal, min_price=lo,
                                         max_price=hi, arrival_qty=arr)
                    .on_conflict_do_update(
                        constraint="uq_price_day",
                        set_={"modal_price": modal, "min_price": lo,
                              "max_price": hi, "arrival_qty": arr})
                )

        # ---- news ---------------------------------------------------------
        # drop rows from earlier seed revisions whose URLs were invented slugs
        # (they 404 in the real world); only this script ever created them
        db.execute(delete(News).where(
            News.url.like("https://farmerin.com/%")
            | News.url.like("%krishijagran.com/news/%")
            | News.url.like("https://www.agropages.com/%")
            # superseded revision: swapped for the verified oneindia article
            | (News.url == "https://www.nationpress.com/all/gujarat-kharif-sowing-at-70percent-led-by-cotton")
        ))
        for n in NEWS:
            db.execute(
                insert(News).values(
                    state_id=state_id[n["state"]], title=n["title"],
                    summary=n["summary"], url=n["url"],
                    video_url=n.get("video_url"), publisher=n["publisher"],
                    published_at=n.get("published"),
                    source_url=n["url"].rsplit("/", 1)[0] + "/",
                    scraped_at=H(2),
                    collector=n["collector"],
                ).on_conflict_do_update(
                    constraint="uq_news_url",
                    set_={
                        "title": n["title"], "summary": n["summary"],
                        "video_url": n.get("video_url"),
                        "publisher": n["publisher"],
                        "published_at": n.get("published"),
                        "scraped_at": H(2),
                    },
                )
            )

        # ---- fertilizer (skip a state block if it already has rows) --------
        have = {r for r in db.execute(
            select(FertilizerPrice.state_id)).all() for r in [r[0]]}
        for st in FERT_STATES:
            sid = state_id[st]
            if sid in have:
                continue
            for prod, price, unit, per_kg in FERTILIZER_PRODUCTS:
                slug = prod.lower().replace(":", "").replace(" ", "-")
                db.add(FertilizerPrice(
                    state_id=sid, product=prod, price=price, unit=unit,
                    price_per_kg=per_kg,
                    source_url=f"https://kisanretailmart.com/{st.lower().replace(' ', '-')}/{slug}",
                    scraped_at=H(5),
                ))

        # ---- crop knowledge -------------------------------------------------
        for k in KNOWLEDGE:
            db.execute(
                insert(CropKnowledge).values(
                    commodity_id=comm_id[k["commodity"]],
                    state_id=state_id[k["state"]],
                    sowing_window=k["sowing"], harvest_window=k["harvest"],
                    districts=k["districts"], notes=k["notes"])
                .on_conflict_do_update(
                    constraint="uq_knowledge_commodity_state",
                    set_={"sowing_window": k["sowing"],
                          "harvest_window": k["harvest"],
                          "districts": k["districts"], "notes": k["notes"]})
            )

        db.commit()
        print("seed_market_data: ok")
        print("  mandis total:", len(mandi_id), "| price blocks:", len(PRICES),
              "| news:", len(NEWS), "| fert states:", len(FERT_STATES),
              "| knowledge:", len(KNOWLEDGE))
    finally:
        db.close()


if __name__ == "__main__":
    main()
