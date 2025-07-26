import sqlite3
from datetime import datetime, date
import json

def init_db():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect('chundiet.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            age INTEGER,
            gender TEXT,
            weight REAL,
            height REAL,
            activity_level TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Meals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            food_item TEXT NOT NULL,
            consumption_time TIMESTAMP,
            date_logged DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Nutrition entries table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nutrition_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_id INTEGER NOT NULL,
            serving_size TEXT,
            calories INTEGER,
            protein TEXT,
            total_carbohydrates TEXT,
            fiber TEXT,
            sugars TEXT,
            total_fat TEXT,
            saturated_fat TEXT,
            vitamins TEXT,  -- JSON string of vitamin data
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meal_id) REFERENCES meals (id)
        )
    ''')
    
    # Settings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            gemini_api_keys TEXT,  -- JSON array of API keys
            ai_temperature REAL DEFAULT 0.5,
            ai_top_p REAL DEFAULT 0.9,
            theme TEXT DEFAULT 'dark',
            units TEXT DEFAULT 'metric',
            notifications_enabled BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Recommendations table for storing AI-generated plans
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recommendations_data TEXT,  -- JSON string of recommendations
            overall_assessment TEXT,
            weekly_goal TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # User goals table for nutrition targets
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            goal_description TEXT,  -- Optional goal description like "lose weight", "gain muscle"
            daily_calories INTEGER,  -- Daily calorie target
            daily_protein INTEGER,  -- Daily protein target in grams
            daily_carbs INTEGER,     -- Daily carbs target in grams
            daily_fat INTEGER,       -- Daily fat target in grams
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Insert default user if not exists
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO users (name, email, age, gender, weight, height, activity_level)
            VALUES ('Demo User', 'demo@chundiet.app', 25, 'prefer_not_to_say', 70.0, 175.0, 'moderate')
        ''')
        
        # Insert default settings
        cursor.execute('''
            INSERT INTO user_settings (user_id, gemini_api_keys)
            VALUES (1, '[]')
        ''')
    
    conn.commit()
    conn.close()

class User:
    def __init__(self, name, email, age=None, gender=None, weight=None, height=None):
        self.name = name
        self.email = email
        self.age = age
        self.gender = gender
        self.weight = weight
        self.height = height

class Meal:
    def __init__(self, user_id, food_item, consumption_time=None):
        self.user_id = user_id
        self.food_item = food_item
        self.consumption_time = consumption_time or datetime.now()

class NutritionEntry:
    def __init__(self, meal_id, nutrition_data):
        self.meal_id = meal_id
        self.serving_size = nutrition_data['nutritional_values']['serving_size']
        self.calories = nutrition_data['nutritional_values']['calories']
        self.protein = nutrition_data['nutritional_values']['protein']
        # Store carbohydrates as individual fields
        carbs = nutrition_data['nutritional_values']['carbohydrates']
        self.total_carbohydrates = carbs['total']
        self.fiber = carbs['fiber']
        self.sugars = carbs['sugars']
        # Store fats as individual fields
        fats = nutrition_data['nutritional_values']['fat']
        self.total_fat = fats['total']
        self.saturated_fat = fats['saturated']
        # Store vitamins as JSON string
        self.vitamins = json.dumps(nutrition_data['nutritional_values']['vitamins'])