from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()
engine = create_engine('sqlite:///ollama_stats.db')
Session = sessionmaker(bind=engine)

class ModelUsage(Base):
    __tablename__ = 'model_usage'
    
    id = Column(Integer, primary_key=True)
    model_name = Column(String, nullable=False)
    operation = Column(String, nullable=False)  # 'generate', 'chat', etc.
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    total_duration = Column(Float)  # in seconds
    timestamp = Column(DateTime, default=datetime.utcnow)

    @classmethod
    def log_usage(cls, model_name, operation, prompt_tokens, completion_tokens, total_duration):
        session = Session()
        try:
            usage = cls(
                model_name=model_name,
                operation=operation,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_duration=total_duration
            )
            session.add(usage)
            session.commit()
        finally:
            session.close()

    @classmethod
    def get_model_stats(cls, model_name=None):
        session = Session()
        try:
            query = session.query(cls)
            if model_name:
                query = query.filter(cls.model_name == model_name)
            
            results = query.all()
            stats = {
                'total_operations': len(results),
                'total_prompt_tokens': sum(r.prompt_tokens for r in results if r.prompt_tokens),
                'total_completion_tokens': sum(r.completion_tokens for r in results if r.completion_tokens),
                'total_duration': sum(r.total_duration for r in results if r.total_duration),
                'operations_by_type': {}
            }
            
            for r in results:
                if r.operation not in stats['operations_by_type']:
                    stats['operations_by_type'][r.operation] = 0
                stats['operations_by_type'][r.operation] += 1
            
            return stats
        finally:
            session.close()

# Create tables
Base.metadata.create_all(engine)
