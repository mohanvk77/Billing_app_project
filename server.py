import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, ReturnDocument
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Enable Cross-Origin Resource Sharing for frontend access

@app.route('/')
def index():
    return app.send_static_file('index.html')

# MongoDB Setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/supermarket")
DB_NAME = os.getenv("DB_NAME", "supermarket")

print(f"Connecting to MongoDB URI: {MONGO_URI.split('@')[-1]}...") # Safe log without password
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def get_next_sequence_value(sequence_name):
    """
    Helper function to generate auto-incrementing integer IDs.
    """
    sequence_document = db.counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return sequence_document["sequence_value"]

def backfill_ids():
    """
    Auto-assigns integer IDs to any pre-existing records that lack one.
    """
    for store_name in ['products', 'customers', 'bills']:
        collection = db[store_name]
        cursor = collection.find({"id": {"$exists": False}})
        count = 0
        for doc in cursor:
            new_id = get_next_sequence_value(store_name)
            collection.update_one({"_id": doc["_id"]}, {"$set": {"id": new_id}})
            count += 1
        if count > 0:
            print(f"Auto-backfilled {count} records with integer IDs in collection: '{store_name}'")

# Run backfill on start
backfill_ids()

# --- Generic CRUD Endpoints ---

@app.route('/api/<store_name>', methods=['GET'])
def get_all(store_name):
    if store_name not in ['products', 'customers', 'bills']:
        return jsonify({"error": "Invalid store name"}), 400
    
    collection = db[store_name]
    items = list(collection.find({}, {"_id": 0})) # Exclude MongoDB native _id
    return jsonify(items)

@app.route('/api/<store_name>/<int:item_id>', methods=['GET'])
def get_one(store_name, item_id):
    if store_name not in ['products', 'customers', 'bills']:
        return jsonify({"error": "Invalid store name"}), 400
    
    collection = db[store_name]
    item = collection.find_one({"id": item_id}, {"_id": 0})
    if not item:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(item)

@app.route('/api/<store_name>', methods=['POST'])
def add_item(store_name):
    if store_name not in ['products', 'customers', 'bills']:
        return jsonify({"error": "Invalid store name"}), 400
    
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Generate auto-increment integer ID
    data = dict(data)
    data["id"] = get_next_sequence_value(store_name)
    
    collection = db[store_name]
    
    # Handle unique constraint validation if necessary (e.g. customer phone)
    if store_name == 'customers' and "phone" in data:
        existing = collection.find_one({"phone": data["phone"]})
        if existing:
            return jsonify({"error": "Customer with this phone number already exists"}), 400
            
    collection.insert_one(data)
    
    # Return serializable copy
    data_response = {k: v for k, v in data.items() if k != "_id"}
    return jsonify(data_response), 201

@app.route('/api/<store_name>/<int:item_id>', methods=['PUT'])
def update_item(store_name, item_id):
    if store_name not in ['products', 'customers', 'bills']:
        return jsonify({"error": "Invalid store name"}), 400
    
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    collection = db[store_name]
    
    # Remove id and _id from request body to prevent updates to keys
    data = dict(data)
    data.pop("_id", None)
    data["id"] = item_id
    
    result = collection.replace_one({"id": item_id}, data)
    if result.matched_count == 0:
        return jsonify({"error": "Item not found"}), 404
        
    return jsonify(data)

@app.route('/api/<store_name>/<int:item_id>', methods=['DELETE'])
def delete_item(store_name, item_id):
    if store_name not in ['products', 'customers', 'bills']:
        return jsonify({"error": "Invalid store name"}), 400
        
    collection = db[store_name]
    result = collection.delete_one({"id": item_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Item not found"}), 404
        
    return jsonify({"success": True})

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
