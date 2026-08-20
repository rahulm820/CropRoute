"""One row into every table, then roll back. Run: python -m db.smoke

Proves the schema actually accepts data - FKs resolve, constraints allow the happy path
and reject the obvious bad path. Not a seed script; issue #6 owns real seed data.
"""

import datetime as dt
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from db.session import SessionLocal
from models import (
    CollectorRun,
    Commodity,
    CropKnowledge,
    Dealer,
    FertilizerPrice,
    Mandi,
    News,
    Post,
    Price,
    State,
    User,
)

NOW = dt.datetime.now(dt.timezone.utc)
SRC = "https://example.gov.in/mandi-list"


def main():
    db = SessionLocal()
    try:
        commodity = Commodity(name="__smoke_wheat", category="cereal")
        state = State(name="__smoke_punjab", lat=Decimal("30.9"), lng=Decimal("75.8"))
        db.add_all([commodity, state])
        db.flush()

        mandi = Mandi(state_id=state.id, name="Khanna", aliases=["Khanna(Grain Market)"])
        user = User(name="Rahul", role="farmer", state_id=state.id)
        db.add_all([mandi, user])
        db.flush()

        db.add_all([
            Price(commodity_id=commodity.id, mandi_id=mandi.id, min_price=Decimal("2280"),
                  max_price=Decimal("2460"), modal_price=Decimal("2350"),
                  arrival_qty=Decimal("1840"), date=dt.date(2026, 8, 18)),
            Dealer(mandi_id=mandi.id, name="R. Singh", phone="+911234567890",
                   role="commission agent", source_url=SRC, scraped_at=NOW),
            News(state_id=state.id, title="Wheat arrivals rise", url=SRC + "/news/1",
                 publisher="The Tribune", published_at=NOW, source_url=SRC, scraped_at=NOW,
                 collector="punjab_agri_news"),
            FertilizerPrice(state_id=state.id, product="Urea", price=Decimal("266"),
                            unit="45kg bag", price_per_kg=Decimal("5.9111"),
                            source_url=SRC, scraped_at=NOW),
            CropKnowledge(commodity_id=commodity.id, state_id=state.id,
                          sowing_window="Nov-Dec", harvest_window="Mar-Apr",
                          districts=["Ludhiana", "Patiala"]),
            Post(user_id=user.id, commodity_id=commodity.id, mandi_id=mandi.id,
                 state_id=state.id, price=Decimal("2310"), note="gate rate today"),
            CollectorRun(collector_id="punjab_apmc", target_state="__smoke_punjab",
                         status="broken", notes="office_phone empty in 40/41 rows",
                         field_completeness=Decimal("0.024")),
        ])
        db.flush()

        for model in (Commodity, State, Mandi, Price, Dealer, News, FertilizerPrice,
                      CropKnowledge, User, Post, CollectorRun):
            assert db.query(model).count() >= 1, f"{model.__tablename__} empty"

        # constraints must actually bite
        for bad, why in (
            (User(name="x", role="trader", state_id=state.id), "role check"),
            (Post(user_id=user.id, commodity_id=commodity.id, state_id=state.id,
                  price=Decimal("-1")), "price check"),
            (CollectorRun(collector_id="x", status="exploded"), "status check"),
            (Price(commodity_id=commodity.id, mandi_id=mandi.id, modal_price=Decimal("1"),
                   date=dt.date(2026, 8, 18)), "duplicate day"),
        ):
            try:
                # savepoint: roll back just this bad row, keep the good ones so the
                # next bad row still has real FK targets to point at
                with db.begin_nested():
                    db.add(bad)
                    db.flush()
                raise AssertionError(f"{why} did not reject bad row")
            except IntegrityError:
                pass

        print("smoke ok: 11 tables accepted a row, 4 constraints rejected bad rows")
    finally:
        db.rollback()  # leave the DB exactly as we found it
        db.close()


if __name__ == "__main__":
    main()
