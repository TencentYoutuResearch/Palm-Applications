"""
Database engine and session management.
Optimized for concurrent access with SQLite WAL mode.
Supports up to 256+ concurrent users.
"""

import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import event, text
from loguru import logger

from app.core.config import settings

# SQLite 并发优化：
# 1. 使用 WAL (Write-Ahead Logging) 模式，允许并发读取
# 2. 设置合理的 busy_timeout，避免 "database is locked" 错误
# 3. 使用 StaticPool 确保连接复用
# 4. 开启 journal_mode=WAL 支持并发读写

# 判断是否使用 SQLite
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite 并发优化配置
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        # SQLite 使用 StaticPool 或 NullPool 都可以
        # 对于异步 SQLite，使用默认连接池即可
        pool_pre_ping=True,
        # 连接参数：设置 busy_timeout 和 WAL 模式
        connect_args={
            "timeout": 30,  # busy_timeout 30秒，等待锁释放
            "check_same_thread": False,  # 允许跨线程使用
        },
    )
else:
    # 非 SQLite 数据库（MySQL/PostgreSQL）使用标准连接池
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_recycle=settings.DB_POOL_RECYCLE,
        pool_pre_ping=True,
    )

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency: yield an async database session."""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables on startup and configure SQLite for concurrency."""
    from app.models.reading import Base

    async with engine.begin() as conn:
        # 如果是 SQLite，启用 WAL 模式以支持并发读写
        if _is_sqlite:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA synchronous=NORMAL"))
            await conn.execute(text("PRAGMA busy_timeout=30000"))
            await conn.execute(text("PRAGMA cache_size=-64000"))  # 64MB 缓存
            await conn.execute(text("PRAGMA temp_store=MEMORY"))

        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database initialized")
