class AppDatabase {
    constructor() {
        // Use relative path when hosted on the same server, otherwise fallback to local server
        this.apiUrl = (window.location.protocol === 'file:') 
            ? 'http://localhost:5000/api' 
            : '/api';
    }

    async init() {
        try {
            // Simple health check call to see if the Flask server is running
            const response = await fetch(`${this.apiUrl}/products`);
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }
            console.log("Connected to MongoDB via backend API successfully.");
            return true;
        } catch (error) {
            console.error("Backend database connection failed:", error);
            throw new Error("Unable to connect to backend server. Make sure server.py is running.");
        }
    }

    // --- Generic CRUD Operations ---
    
    async add(storeName, data) {
        try {
            const response = await fetch(`${this.apiUrl}/${storeName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Failed to add item to ${storeName}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error in add(${storeName}):`, error);
            throw error;
        }
    }

    async update(storeName, data) {
        try {
            const response = await fetch(`${this.apiUrl}/${storeName}/${data.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Failed to update item in ${storeName}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error in update(${storeName}):`, error);
            throw error;
        }
    }

    async delete(storeName, id) {
        try {
            const response = await fetch(`${this.apiUrl}/${storeName}/${Number(id)}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Failed to delete item from ${storeName}`);
            }
            return true;
        } catch (error) {
            console.error(`Error in delete(${storeName}):`, error);
            throw error;
        }
    }

    async get(storeName, id) {
        try {
            const response = await fetch(`${this.apiUrl}/${storeName}/${Number(id)}`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Failed to get item from ${storeName}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error in get(${storeName}):`, error);
            throw error;
        }
    }

    async getAll(storeName) {
        try {
            const response = await fetch(`${this.apiUrl}/${storeName}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch all items from ${storeName}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error in getAll(${storeName}):`, error);
            throw error;
        }
    }
}

// Export a singleton instance
const db = new AppDatabase();
