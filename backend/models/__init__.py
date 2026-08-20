"""All CropRoute tables. One file - the schema is small enough to read in one sitting.

Prices are INR per quintal (100kg) unless a column says otherwise. Timestamps are
timezone-aware UTC. Anything scraped carries source_url + scraped_at (see CLAUDE.md).
"""

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

ROLES = ("farmer", "wholesaler")
COLLECTOR_STATUSES = ("healthy", "broken", "self_healed", "failed")


class Commodity(Base):
    __tablename__ = "commodities"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False, unique=True)
    category = Column(String(40))


class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False, unique=True)
    # centroid, used for the map and for the Open-Meteo weather query
    lat = Column(Numeric(8, 5))
    lng = Column(Numeric(8, 5))

    mandis = relationship("Mandi", back_populates="state")


class Mandi(Base):
    __tablename__ = "mandis"
    __table_args__ = (
        UniqueConstraint("state_id", "name", name="uq_mandi_state_name"),
        Index("ix_mandis_state_id", "state_id"),
    )

    id = Column(Integer, primary_key=True)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    lat = Column(Numeric(8, 5))
    lng = Column(Numeric(8, 5))
    # Agmarknet spells the same market several ways - keep every spelling we have seen
    # so ingest matches instead of creating twins. See docs/DATA-SOURCES.md.
    aliases = Column(ARRAY(Text))

    state = relationship("State", back_populates="mandis")


class Price(Base):
    __tablename__ = "prices"
    __table_args__ = (
        # upsert key: one row per commodity per mandi per day (issue #8 idempotency)
        UniqueConstraint("commodity_id", "mandi_id", "date", name="uq_price_day"),
        Index("ix_prices_commodity_date", "commodity_id", "date"),
        Index("ix_prices_mandi_date", "mandi_id", "date"),
        CheckConstraint("modal_price >= 0", name="ck_price_non_negative"),
    )

    id = Column(Integer, primary_key=True)
    commodity_id = Column(Integer, ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    mandi_id = Column(Integer, ForeignKey("mandis.id", ondelete="CASCADE"), nullable=False)
    min_price = Column(Numeric(10, 2))
    max_price = Column(Numeric(10, 2))
    modal_price = Column(Numeric(10, 2), nullable=False)
    # null means "not reported", never 0 - a 0 would rank as a real supply signal
    arrival_qty = Column(Numeric(12, 2))
    date = Column(Date, nullable=False)


class Dealer(Base):
    __tablename__ = "dealers"
    __table_args__ = (Index("ix_dealers_mandi_id", "mandi_id"),)

    id = Column(Integer, primary_key=True)
    mandi_id = Column(Integer, ForeignKey("mandis.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(160), nullable=False)
    phone = Column(String(40))
    role = Column(String(60))  # "commission agent", "market office", ...
    source_url = Column(Text, nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class News(Base):
    __tablename__ = "news"
    __table_args__ = (
        UniqueConstraint("url", name="uq_news_url"),
        Index("ix_news_state_published", "state_id", "published_at"),
    )

    id = Column(Integer, primary_key=True)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    summary = Column(Text)
    url = Column(Text, nullable=False)
    image_url = Column(Text)
    video_url = Column(Text)  # non-null means NewsCard embeds a player
    publisher = Column(String(120))
    published_at = Column(DateTime(timezone=True))
    source_url = Column(Text, nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    collector = Column(String(60))


class FertilizerPrice(Base):
    __tablename__ = "fertilizer_prices"
    __table_args__ = (Index("ix_fertilizer_state_scraped", "state_id", "scraped_at"),)

    id = Column(Integer, primary_key=True)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    product = Column(String(80), nullable=False)  # Urea, DAP, MOP
    price = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(40), nullable=False)  # "45kg bag" - pack sizes differ by brand
    # normalized so a 45kg and a 50kg bag compare without a bogus delta
    price_per_kg = Column(Numeric(10, 4))
    source_url = Column(Text, nullable=False)
    scraped_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CropKnowledge(Base):
    __tablename__ = "crop_knowledge"
    __table_args__ = (
        UniqueConstraint("commodity_id", "state_id", name="uq_knowledge_commodity_state"),
    )

    id = Column(Integer, primary_key=True)
    commodity_id = Column(Integer, ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    sowing_window = Column(String(120))
    harvest_window = Column(String(120))
    districts = Column(ARRAY(Text))
    notes = Column(Text)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role in ('farmer', 'wholesaler')", name="ck_user_role"),)

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False)
    role = Column(String(20), nullable=False)
    state_id = Column(Integer, ForeignKey("states.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Post(Base):
    """A farmer's ground-truth price report. Not scraped data - never gets a provenance
    chip, gets an 'unverified' badge instead."""

    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_state_created", "state_id", "created_at"),
        Index("ix_posts_commodity_created", "commodity_id", "created_at"),
        CheckConstraint("price > 0", name="ck_post_price_positive"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    commodity_id = Column(Integer, ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False)
    mandi_id = Column(Integer, ForeignKey("mandis.id", ondelete="SET NULL"))
    state_id = Column(Integer, ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    note = Column(Text)
    image_url = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CollectorRun(Base):
    """One row per collector state transition. This table is the self-heal demo
    artifact - see docs/SELF-HEAL.md."""

    __tablename__ = "collector_runs"
    __table_args__ = (
        Index("ix_collector_runs_collector_ran", "collector_id", "ran_at"),
        CheckConstraint(
            "status in ('healthy', 'broken', 'self_healed', 'failed')",
            name="ck_collector_status",
        ),
    )

    id = Column(Integer, primary_key=True)
    collector_id = Column(String(60), nullable=False)  # matches scrapers/*.json "name"
    target_state = Column(String(80))
    status = Column(String(20), nullable=False)
    ran_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # evidence string, e.g. "office_phone empty in 40/41 rows, baseline 0.95"
    notes = Column(Text)
    field_completeness = Column(Numeric(4, 3))
