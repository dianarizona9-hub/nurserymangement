from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from bson import ObjectId
import csv
import io
from fastapi.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "nursery_secret_key_change_in_production"
ALGORITHM = "HS256"
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class SeedlingReceived(BaseModel):
    date: str
    type: str
    supplier: str
    price: float
    lot_number: str
    quantity: int
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DeliveryNote(BaseModel):
    date: str
    type: str
    expected_quantity: int
    actual_quantity: int
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DeadSeedling(BaseModel):
    date: str
    type: str
    quantity: int
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DiscardedSeedling(BaseModel):
    date: str
    type: str
    quantity: int
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class NurseryProduced(BaseModel):
    date: str
    type: str
    quantity: int
    parent_plant: str
    propagation_method: str
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DistributedSeedling(BaseModel):
    date: str
    type: str
    quantity: int
    destination: str
    location: str
    user_id: str
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class DashboardStats(BaseModel):
    total_received: int
    total_dead: int
    total_discarded: int
    total_produced: int
    total_distributed: int
    survival_rate: float
    total_in_nursery: int

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserRegister):
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(user.password)
    user_doc = {
        "username": user.username,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

# Seedlings Received endpoints
@api_router.post("/seedlings-received")
async def create_seedling_received(seedling: SeedlingReceived, username: str = Depends(get_current_user)):
    seedling_dict = seedling.dict()
    seedling_dict["user_id"] = username
    result = await db.seedlings_received.insert_one(seedling_dict)
    seedling_dict["_id"] = str(result.inserted_id)
    return seedling_dict

@api_router.get("/seedlings-received")
async def get_seedlings_received(username: str = Depends(get_current_user)):
    seedlings = await db.seedlings_received.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for s in seedlings:
        s["_id"] = str(s["_id"])
    return seedlings

@api_router.delete("/seedlings-received/{id}")
async def delete_seedling_received(id: str, username: str = Depends(get_current_user)):
    result = await db.seedlings_received.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Delivery Notes endpoints
@api_router.post("/delivery-notes")
async def create_delivery_note(note: DeliveryNote, username: str = Depends(get_current_user)):
    note_dict = note.dict()
    note_dict["user_id"] = username
    result = await db.delivery_notes.insert_one(note_dict)
    note_dict["_id"] = str(result.inserted_id)
    return note_dict

@api_router.get("/delivery-notes")
async def get_delivery_notes(username: str = Depends(get_current_user)):
    notes = await db.delivery_notes.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for n in notes:
        n["_id"] = str(n["_id"])
    return notes

@api_router.delete("/delivery-notes/{id}")
async def delete_delivery_note(id: str, username: str = Depends(get_current_user)):
    result = await db.delivery_notes.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Dead Seedlings endpoints
@api_router.post("/dead-seedlings")
async def create_dead_seedling(seedling: DeadSeedling, username: str = Depends(get_current_user)):
    seedling_dict = seedling.dict()
    seedling_dict["user_id"] = username
    result = await db.dead_seedlings.insert_one(seedling_dict)
    seedling_dict["_id"] = str(result.inserted_id)
    return seedling_dict

@api_router.get("/dead-seedlings")
async def get_dead_seedlings(username: str = Depends(get_current_user)):
    seedlings = await db.dead_seedlings.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for s in seedlings:
        s["_id"] = str(s["_id"])
    return seedlings

@api_router.delete("/dead-seedlings/{id}")
async def delete_dead_seedling(id: str, username: str = Depends(get_current_user)):
    result = await db.dead_seedlings.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Discarded Seedlings endpoints
@api_router.post("/discarded-seedlings")
async def create_discarded_seedling(seedling: DiscardedSeedling, username: str = Depends(get_current_user)):
    seedling_dict = seedling.dict()
    seedling_dict["user_id"] = username
    result = await db.discarded_seedlings.insert_one(seedling_dict)
    seedling_dict["_id"] = str(result.inserted_id)
    return seedling_dict

@api_router.get("/discarded-seedlings")
async def get_discarded_seedlings(username: str = Depends(get_current_user)):
    seedlings = await db.discarded_seedlings.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for s in seedlings:
        s["_id"] = str(s["_id"])
    return seedlings

@api_router.delete("/discarded-seedlings/{id}")
async def delete_discarded_seedling(id: str, username: str = Depends(get_current_user)):
    result = await db.discarded_seedlings.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Nursery Produced endpoints
@api_router.post("/nursery-produced")
async def create_nursery_produced(seedling: NurseryProduced, username: str = Depends(get_current_user)):
    seedling_dict = seedling.dict()
    seedling_dict["user_id"] = username
    result = await db.nursery_produced.insert_one(seedling_dict)
    seedling_dict["_id"] = str(result.inserted_id)
    return seedling_dict

@api_router.get("/nursery-produced")
async def get_nursery_produced(username: str = Depends(get_current_user)):
    seedlings = await db.nursery_produced.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for s in seedlings:
        s["_id"] = str(s["_id"])
    return seedlings

@api_router.delete("/nursery-produced/{id}")
async def delete_nursery_produced(id: str, username: str = Depends(get_current_user)):
    result = await db.nursery_produced.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Distributed Seedlings endpoints
@api_router.post("/distributed-seedlings")
async def create_distributed_seedling(seedling: DistributedSeedling, username: str = Depends(get_current_user)):
    seedling_dict = seedling.dict()
    seedling_dict["user_id"] = username
    result = await db.distributed_seedlings.insert_one(seedling_dict)
    seedling_dict["_id"] = str(result.inserted_id)
    return seedling_dict

@api_router.get("/distributed-seedlings")
async def get_distributed_seedlings(username: str = Depends(get_current_user)):
    seedlings = await db.distributed_seedlings.find({"user_id": username}).sort("created_at", -1).to_list(1000)
    for s in seedlings:
        s["_id"] = str(s["_id"])
    return seedlings

@api_router.delete("/distributed-seedlings/{id}")
async def delete_distributed_seedling(id: str, username: str = Depends(get_current_user)):
    result = await db.distributed_seedlings.delete_one({"_id": ObjectId(id), "user_id": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted successfully"}

# Dashboard statistics
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(username: str = Depends(get_current_user)):
    # Get totals
    received = await db.seedlings_received.find({"user_id": username}).to_list(1000)
    dead = await db.dead_seedlings.find({"user_id": username}).to_list(1000)
    discarded = await db.discarded_seedlings.find({"user_id": username}).to_list(1000)
    produced = await db.nursery_produced.find({"user_id": username}).to_list(1000)
    
    total_received = sum(s.get("quantity", 0) for s in received)
    total_dead = sum(s.get("quantity", 0) for s in dead)
    total_discarded = sum(s.get("quantity", 0) for s in discarded)
    total_produced = sum(s.get("quantity", 0) for s in produced)
    
    # Calculate total in nursery and survival rate
    total_in_nursery = total_received + total_produced - total_dead - total_discarded
    total_input = total_received + total_produced
    survival_rate = ((total_in_nursery / total_input) * 100) if total_input > 0 else 0
    
    return {
        "total_received": total_received,
        "total_dead": total_dead,
        "total_discarded": total_discarded,
        "total_produced": total_produced,
        "survival_rate": round(survival_rate, 2),
        "total_in_nursery": total_in_nursery
    }

# Export to CSV
@api_router.get("/export/csv")
async def export_to_csv(username: str = Depends(get_current_user)):
    # Get all data
    received = await db.seedlings_received.find({"user_id": username}).to_list(1000)
    delivery = await db.delivery_notes.find({"user_id": username}).to_list(1000)
    dead = await db.dead_seedlings.find({"user_id": username}).to_list(1000)
    discarded = await db.discarded_seedlings.find({"user_id": username}).to_list(1000)
    produced = await db.nursery_produced.find({"user_id": username}).to_list(1000)
    
    # Create CSV in memory
    output = io.StringIO()
    
    # Seedlings Received
    output.write("\n=== SEEDLINGS RECEIVED ===\n")
    if received:
        writer = csv.DictWriter(output, fieldnames=["date", "type", "supplier", "price", "lot_number", "quantity"])
        writer.writeheader()
        for item in received:
            writer.writerow({
                "date": item.get("date"),
                "type": item.get("type"),
                "supplier": item.get("supplier"),
                "price": item.get("price"),
                "lot_number": item.get("lot_number"),
                "quantity": item.get("quantity")
            })
    
    # Delivery Notes
    output.write("\n\n=== DELIVERY NOTES ===\n")
    if delivery:
        writer = csv.DictWriter(output, fieldnames=["date", "type", "expected_quantity", "actual_quantity"])
        writer.writeheader()
        for item in delivery:
            writer.writerow({
                "date": item.get("date"),
                "type": item.get("type"),
                "expected_quantity": item.get("expected_quantity"),
                "actual_quantity": item.get("actual_quantity")
            })
    
    # Dead Seedlings
    output.write("\n\n=== DEAD SEEDLINGS ===\n")
    if dead:
        writer = csv.DictWriter(output, fieldnames=["date", "type", "quantity"])
        writer.writeheader()
        for item in dead:
            writer.writerow({
                "date": item.get("date"),
                "type": item.get("type"),
                "quantity": item.get("quantity")
            })
    
    # Discarded Seedlings
    output.write("\n\n=== DISCARDED SEEDLINGS ===\n")
    if discarded:
        writer = csv.DictWriter(output, fieldnames=["date", "type", "quantity"])
        writer.writeheader()
        for item in discarded:
            writer.writerow({
                "date": item.get("date"),
                "type": item.get("type"),
                "quantity": item.get("quantity")
            })
    
    # Nursery Produced
    output.write("\n\n=== NURSERY PRODUCED ===\n")
    if produced:
        writer = csv.DictWriter(output, fieldnames=["date", "type", "quantity", "parent_plant", "propagation_method"])
        writer.writeheader()
        for item in produced:
            writer.writerow({
                "date": item.get("date"),
                "type": item.get("type"),
                "quantity": item.get("quantity"),
                "parent_plant": item.get("parent_plant"),
                "propagation_method": item.get("propagation_method")
            })
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=nursery_data_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
