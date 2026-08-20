"""Create every table. Run: python -m db.init_db

ponytail: create_all instead of Alembic. The schema has no production data to migrate
yet, so versioned migrations buy nothing this week. Switch to Alembic (folder is already
at db/migrations/) the moment a schema change has to survive real data - autogenerate
will pick these models up unchanged.
"""

from models import Base
from db.session import engine


def main():
    Base.metadata.create_all(engine)
    print(f"created {len(Base.metadata.tables)} tables: {', '.join(sorted(Base.metadata.tables))}")


if __name__ == "__main__":
    main()
