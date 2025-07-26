from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from models import init_db, User, Meal, NutritionEntry
from gemini_service import GeminiNutritionAnalyzer
from database import DatabaseManager
import os
from datetime import datetime, date
import json

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
CORS(app)

# Initialize components
db_manager = DatabaseManager('chundiet.db')
gemini_analyzer = GeminiNutritionAnalyzer()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory(os.path.join(app.root_path, '../frontend/assets'), filename)

# API Routes
@app.route('/api/analyze-meal', methods=['POST'])
def analyze_meal():
    """
    Process natural language meal input through Gemini API
    Expected input: {"description": "I ate pizza", "time": "2025-01-15T18:30:00"}
    """
    data = request.get_json()
    meal_description = data.get('description')
    meal_time = data.get('time')
    user_id = data.get('user_id', 1)  # Default user for simplicity
    
    try:
        # Get user settings for API keys
        settings = db_manager.get_user_settings(user_id)
        if settings.get('gemini_api_keys'):
            gemini_analyzer.set_api_keys(settings['gemini_api_keys'])
        
        # Call Gemini API for nutrition analysis
        nutrition_data = gemini_analyzer.analyze_meal(
            meal_description, 
            meal_time,
            temperature=settings.get('ai_temperature', 0.5)
        )
        
        # Store in database
        meal_id = db_manager.store_meal(user_id, nutrition_data)
        
        return jsonify({
            'success': True,
            'meal_id': meal_id,
            'nutrition_data': nutrition_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/daily-summary/<date_str>')
def get_daily_summary(date_str):
    """Get aggregated nutrition data for a specific date"""
    user_id = request.args.get('user_id', 1)
    summary = db_manager.get_daily_summary(user_id, date_str)
    return jsonify(summary)

@app.route('/api/history')
def get_history():
    """Get nutrition history with pagination"""
    user_id = request.args.get('user_id', 1)
    days = int(request.args.get('days', 30))
    history = db_manager.get_nutrition_history(user_id, days)
    return jsonify(history)

@app.route('/api/ai-recommendations', methods=['GET', 'POST'])
def get_ai_recommendations():
    """Get stored recommendations or generate new ones"""
    user_id = request.args.get('user_id', 1) if request.method == 'GET' else request.get_json().get('user_id', 1)
    
    if request.method == 'GET':
        # Return stored recommendations
        stored_recommendations = db_manager.get_stored_recommendations(user_id)
        if stored_recommendations:
            return jsonify(stored_recommendations)
        else:
            return jsonify({'recommendations': [], 'message': 'No recommendations found'})
    
    elif request.method == 'POST':
        # Generate new recommendations
        try:
            # Get user's recent nutrition data
            recent_data = db_manager.get_recent_nutrition_summary(user_id, days=7)
            user_profile = db_manager.get_user_profile(user_id)
            user_goals = db_manager.get_user_goals(user_id)
            
            # Get user settings for API keys
            settings = db_manager.get_user_settings(user_id)
            if settings.get('gemini_api_keys'):
                gemini_analyzer.set_api_keys(settings['gemini_api_keys'])
            
            # Generate recommendations via Gemini
            recommendations = gemini_analyzer.generate_recommendations(
                recent_data, 
                user_profile,
                user_goals,
                temperature=settings.get('ai_temperature', 0.7)
            )
            
            # Store recommendations in database
            db_manager.store_recommendations(user_id, recommendations)
            
            return jsonify(recommendations)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/user/profile', methods=['GET', 'POST'])
def user_profile():
    """Get or update user profile"""
    user_id = request.args.get('user_id', 1)
    
    if request.method == 'GET':
        profile = db_manager.get_user_profile(user_id)
        return jsonify(profile)
    
    elif request.method == 'POST':
        profile_data = request.get_json()
        success = db_manager.update_user_profile(user_id, profile_data)
        return jsonify({'success': success})

@app.route('/api/settings', methods=['GET', 'POST'])
def app_settings():
    """Manage application settings"""
    user_id = request.args.get('user_id', 1)
    
    if request.method == 'GET':
        settings = db_manager.get_user_settings(user_id)
        return jsonify(settings)
    
    elif request.method == 'POST':
        settings_data = request.get_json()
        success = db_manager.update_user_settings(user_id, settings_data)
        return jsonify({'success': success})

@app.route('/api/delete-meal/<int:meal_id>', methods=['DELETE'])
def delete_meal(meal_id):
    """Delete a meal entry"""
    user_id = int(request.args.get('user_id', 1))
    
    print(f"[API] DELETE MEAL API REQUEST: meal_id={meal_id}, user_id={user_id}")
    
    try:
        success = db_manager.delete_meal(meal_id, user_id)
        print(f"[API] Delete operation result: {success}")
        return jsonify({'success': success})
    except Exception as e:
        print(f"[API ERROR] Delete meal API error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/user/goals', methods=['GET', 'POST'])
def user_goals():
    """Get or update user nutrition goals"""
    user_id = request.args.get('user_id', 1)
    
    if request.method == 'GET':
        goals = db_manager.get_user_goals(user_id)
        return jsonify(goals)
    
    elif request.method == 'POST':
        goals_data = request.get_json()
        success = db_manager.update_user_goals(user_id, goals_data)
        return jsonify({'success': success})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)