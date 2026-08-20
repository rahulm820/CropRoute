"""Reference data: Indian states/UTs with map centroids, and tracked commodities.

Run: python -m db.seed   (idempotent - re-running updates values, never duplicates)
"""

from decimal import Decimal

from sqlalchemy.dialects.postgresql import insert

from db.session import SessionLocal, engine
from models import Base, Commodity, State

# name, lat, lng - polygon centroids, used for the map and the Open-Meteo query.
# All 28 states + 8 union territories.
STATES = [
    ("Andhra Pradesh", 15.91, 79.74),
    ("Arunachal Pradesh", 28.22, 94.73),
    ("Assam", 26.20, 92.94),
    ("Bihar", 25.10, 85.31),
    ("Chhattisgarh", 21.28, 81.87),
    ("Goa", 15.30, 74.12),
    ("Gujarat", 22.26, 71.19),
    ("Haryana", 29.06, 76.09),
    ("Himachal Pradesh", 31.10, 77.17),
    ("Jharkhand", 23.61, 85.28),
    ("Karnataka", 15.32, 75.71),
    ("Kerala", 10.85, 76.27),
    ("Madhya Pradesh", 22.97, 78.66),
    ("Maharashtra", 19.75, 75.71),
    ("Manipur", 24.66, 93.91),
    ("Meghalaya", 25.47, 91.37),
    ("Mizoram", 23.16, 92.94),
    ("Nagaland", 26.16, 94.56),
    ("Odisha", 20.95, 85.10),
    ("Punjab", 31.15, 75.34),
    ("Rajasthan", 27.02, 74.22),
    ("Sikkim", 27.53, 88.51),
    ("Tamil Nadu", 11.13, 78.66),
    ("Telangana", 18.11, 79.02),
    ("Tripura", 23.94, 91.99),
    ("Uttar Pradesh", 26.85, 80.95),
    ("Uttarakhand", 30.07, 79.09),
    ("West Bengal", 22.99, 87.85),
    ("Andaman and Nicobar Islands", 11.74, 92.66),
    ("Chandigarh", 30.73, 76.78),
    ("Dadra and Nagar Haveli and Daman and Diu", 20.40, 72.83),
    ("Delhi", 28.70, 77.10),
    ("Jammu and Kashmir", 33.28, 75.34),
    ("Ladakh", 34.15, 77.58),
    ("Lakshadweep", 10.57, 72.64),
    ("Puducherry", 11.94, 79.81),
]

# Display names. Agmarknet's own commodity strings are messier ("Paddy(Dhan)(Common)",
# "Bengal Gram(Gram)(Whole)") - issue #7 owns that mapping, not this file.
COMMODITIES = [
    ("Wheat", "cereal"),
    ("Rice", "cereal"),
    ("Paddy", "cereal"),
    ("Maize", "cereal"),
    ("Bajra", "cereal"),
    ("Jowar", "cereal"),
    ("Gram", "pulse"),
    ("Tur", "pulse"),
    ("Moong", "pulse"),
    ("Masoor", "pulse"),
    ("Urad", "pulse"),
    ("Soybean", "oilseed"),
    ("Mustard", "oilseed"),
    ("Groundnut", "oilseed"),
    ("Onion", "vegetable"),
    ("Potato", "vegetable"),
    ("Tomato", "vegetable"),
    ("Cotton", "cash crop"),
    ("Sugarcane", "cash crop"),
]


def _upsert(db, model, rows, update_cols):
    """Insert rows, updating the given columns when name already exists.

    Upsert rather than skip-on-conflict so correcting a centroid or a category takes
    effect on the next run instead of needing a manual UPDATE.
    """
    stmt = insert(model).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[model.name],
        set_={c: getattr(stmt.excluded, c) for c in update_cols},
    )
    db.execute(stmt)


def main():
    Base.metadata.create_all(engine)  # no-op if db.init_db already ran
    db = SessionLocal()
    try:
        _upsert(
            db,
            State,
            [{"name": n, "lat": Decimal(str(lat)), "lng": Decimal(str(lng))} for n, lat, lng in STATES],
            ["lat", "lng"],
        )
        _upsert(
            db,
            Commodity,
            [{"name": n, "category": c} for n, c in COMMODITIES],
            ["category"],
        )
        db.commit()
        print(f"seeded {db.query(State).count()} states, {db.query(Commodity).count()} commodities")
    finally:
        db.close()


if __name__ == "__main__":
    main()
