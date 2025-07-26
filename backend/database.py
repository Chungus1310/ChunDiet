import sqlite3
import json
from datetime import datetime, date, timedelta
from typing import Dict, List, Any

class DatabaseManager:
    def __init__(self, db_path):
        self.db_path = db_path
    
    def get_connection(self):
        return sqlite3.connect(self.db_path)
    
    def store_meal(self, user_id: int, nutrition_data: Dict) -> int:
        """Store meal and nutrition data, return meal_id"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Insert meal record
            cursor.execute('''
                INSERT INTO meals (user_id, food_item, consumption_time)
                VALUES (?, ?, ?)
            ''', (
                user_id,
                nutrition_data['food_item'],
                nutrition_data.get('consumption_time')
            ))
            
            meal_id = cursor.lastrowid
            
            # Insert nutrition data
            nutritional_values = nutrition_data['nutritional_values']
            carbs = nutritional_values['carbohydrates']
            fats = nutritional_values['fat']
            vitamins_json = json.dumps(nutritional_values['vitamins'])
            
            cursor.execute('''
                INSERT INTO nutrition_entries (
                    meal_id, serving_size, calories, protein,
                    total_carbohydrates, fiber, sugars,
                    total_fat, saturated_fat, vitamins
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                meal_id,
                nutritional_values['serving_size'],
                nutritional_values['calories'],
                nutritional_values['protein'],
                carbs['total'],
                carbs['fiber'],
                carbs['sugars'],
                fats['total'],
                fats['saturated'],
                vitamins_json
            ))
            
            conn.commit()
            return meal_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_daily_summary(self, user_id: int, date_str: str) -> Dict:
        """Get aggregated nutrition data for a specific date"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as meal_count,
                SUM(calories) as total_calories,
                GROUP_CONCAT(protein) as proteins,
                GROUP_CONCAT(total_carbohydrates) as carbs,
                GROUP_CONCAT(total_fat) as fats,
                GROUP_CONCAT(m.food_item) as foods
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND DATE(m.date_logged) = ?
        ''', (user_id, date_str))
        
        result = cursor.fetchone()
        
        # Also get detailed meal list with IDs and full nutrition data for deletion
        cursor.execute('''
            SELECT 
                m.id, 
                m.food_item, 
                n.calories, 
                m.consumption_time,
                n.serving_size,
                n.protein,
                n.total_carbohydrates,
                n.total_fat,
                n.vitamins
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND DATE(m.date_logged) = ?
            ORDER BY m.consumption_time DESC
        ''', (user_id, date_str))
        
        meals_detail = cursor.fetchall()
        conn.close()
        
        if result and result[0] > 0:
            return {
                'date': date_str,
                'meal_count': result[0],
                'total_calories': result[1] or 0,
                'foods': result[5].split(',') if result[5] else [],
                'meals': [
                    {
                        'id': meal[0],
                        'food_item': meal[1],
                        'calories': meal[2],
                        'time': meal[3],
                        'serving_size': meal[4],
                        'protein': meal[5],
                        'carbohydrates': meal[6],
                        'fat': meal[7],
                        'vitamins': json.loads(meal[8]) if meal[8] else []
                    } for meal in meals_detail
                ],
                'summary': f"{result[0]} meals, {result[1] or 0} calories"
            }
        else:
            return {
                'date': date_str,
                'meal_count': 0,
                'total_calories': 0,
                'foods': [],
                'meals': [],
                'summary': 'No meals logged'
            }
    
    def get_nutrition_history(self, user_id: int, days: int = 30) -> List[Dict]:
        """Get nutrition history for the past N days"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                DATE(m.date_logged) as date,
                COUNT(*) as meal_count,
                SUM(n.calories) as total_calories,
                GROUP_CONCAT(m.food_item) as foods
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND m.date_logged >= date('now', '-{} days')
            GROUP BY DATE(m.date_logged)
            ORDER BY m.date_logged DESC
        '''.format(days), (user_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        history = []
        for row in results:
            history.append({
                'date': row[0],
                'meal_count': row[1],
                'total_calories': row[2] or 0,
                'foods': row[3].split(',') if row[3] else []
            })
        
        return history
    
    def delete_meal(self, meal_id: int, user_id: int) -> bool:
        """Delete a meal and its nutrition data"""
        print(f"[DELETE] DELETE MEAL REQUEST: meal_id={meal_id}, user_id={user_id}")
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Verify the meal belongs to the user
            cursor.execute('SELECT user_id FROM meals WHERE id = ?', (meal_id,))
            result = cursor.fetchone()
            
            print(f"[CHECK] Meal ownership check: {result}")
            
            if not result:
                print(f"[ERROR] Meal {meal_id} not found")
                return False
                
            if result[0] != user_id:
                print(f"[ERROR] Meal {meal_id} belongs to user {result[0]}, not {user_id}")
                return False
            
            # Check nutrition entries before deletion
            cursor.execute('SELECT COUNT(*) FROM nutrition_entries WHERE meal_id = ?', (meal_id,))
            nutrition_count = cursor.fetchone()[0]
            print(f"[INFO] Found {nutrition_count} nutrition entries for meal {meal_id}")
            
            # Delete nutrition entries first (foreign key constraint)
            cursor.execute('DELETE FROM nutrition_entries WHERE meal_id = ?', (meal_id,))
            deleted_nutrition = cursor.rowcount
            print(f"[DELETE] Deleted {deleted_nutrition} nutrition entries")
            
            # Delete the meal
            cursor.execute('DELETE FROM meals WHERE id = ?', (meal_id,))
            deleted_meals = cursor.rowcount
            print(f"[DELETE] Deleted {deleted_meals} meal records")
            
            conn.commit()
            print(f"[SUCCESS] Successfully deleted meal {meal_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Meal deletion error: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_recent_nutrition_summary(self, user_id: int, days: int = 7) -> Dict:
        """Get detailed nutrition summary for AI recommendations"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get today's meals with full nutrition data
        cursor.execute('''
            SELECT 
                m.food_item,
                m.consumption_time,
                n.calories,
                n.protein,
                n.total_carbohydrates,
                n.total_fat,
                n.vitamins,
                DATE(m.date_logged) as meal_date
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND DATE(m.date_logged) = DATE('now')
            ORDER BY m.consumption_time DESC
        ''', (user_id,))
        
        today_meals = cursor.fetchall()
        
        # Get previous week's meals with nutrition data
        cursor.execute('''
            SELECT 
                m.food_item,
                m.consumption_time,
                n.calories,
                n.protein,
                n.total_carbohydrates,
                n.total_fat,
                n.vitamins,
                DATE(m.date_logged) as meal_date
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND m.date_logged >= date('now', '-{} days') AND DATE(m.date_logged) < DATE('now')
            ORDER BY m.date_logged DESC, m.consumption_time DESC
        '''.format(days), (user_id,))
        
        previous_meals = cursor.fetchall()
        
        # Get aggregated stats with proper daily averages
        cursor.execute('''
            SELECT 
                COUNT(DISTINCT DATE(m.date_logged)) as days_with_data,
                SUM(n.calories) as total_calories,
                COUNT(*) as total_meals,
                GROUP_CONCAT(DISTINCT m.food_item) as unique_foods
            FROM meals m
            JOIN nutrition_entries n ON m.id = n.meal_id
            WHERE m.user_id = ? AND m.date_logged >= date('now', '-{} days')
        '''.format(days), (user_id,))
        
        stats = cursor.fetchone()
        
        # Calculate proper daily average based on actual days with data
        days_with_data = stats[0] or 0
        total_calories = stats[1] or 0
        avg_daily_calories = total_calories / days_with_data if days_with_data > 0 else 0
        
        conn.close()
        
        # Format meals data
        def format_meal(meal_row):
            return {
                'food_item': meal_row[0],
                'consumption_time': meal_row[1],
                'calories': meal_row[2],
                'protein': meal_row[3],
                'carbohydrates': meal_row[4],
                'fat': meal_row[5],
                'vitamins': json.loads(meal_row[6]) if meal_row[6] else [],
                'date': meal_row[7]
            }
        
        return {
            'period_days': days,
            'days_with_data': days_with_data,
            'avg_daily_calories': avg_daily_calories,
            'total_calories': total_calories,
            'total_meals': stats[2] or 0,
            'food_variety': len(stats[3].split(',')) if stats[3] else 0,
            'unique_foods': stats[3].split(',') if stats[3] else [],
            'today_meals': [format_meal(meal) for meal in today_meals],
            'previous_meals': [format_meal(meal) for meal in previous_meals]
        }
    
    def get_user_profile(self, user_id: int) -> Dict:
        """Get user profile data"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'id': result[0],
                'name': result[1],
                'email': result[2],
                'age': result[3],
                'gender': result[4],
                'weight': result[5],
                'height': result[6],
                'activity_level': result[7]
            }
        return {}
    
    def update_user_profile(self, user_id: int, profile_data: Dict) -> bool:
        """Update user profile"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Get current profile data
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            current = cursor.fetchone()
            
            if current:
                # Update existing user
                cursor.execute('''
                    UPDATE users 
                    SET name = COALESCE(?, name), 
                        age = COALESCE(?, age), 
                        gender = COALESCE(?, gender), 
                        weight = COALESCE(?, weight), 
                        height = COALESCE(?, height), 
                        activity_level = COALESCE(?, activity_level)
                    WHERE id = ?
                ''', (
                    profile_data.get('name') if profile_data.get('name') else None,
                    profile_data.get('age') if profile_data.get('age') else None,
                    profile_data.get('gender') if profile_data.get('gender') else None,
                    profile_data.get('weight') if profile_data.get('weight') else None,
                    profile_data.get('height') if profile_data.get('height') else None,
                    profile_data.get('activity_level') if profile_data.get('activity_level') else None,
                    user_id
                ))
            else:
                # Create new user if doesn't exist
                cursor.execute('''
                    INSERT INTO users (id, name, email, age, gender, weight, height, activity_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    profile_data.get('name', 'Demo User'),
                    profile_data.get('email', f'user{user_id}@chundiet.app'),
                    profile_data.get('age'),
                    profile_data.get('gender'),
                    profile_data.get('weight'),
                    profile_data.get('height'),
                    profile_data.get('activity_level')
                ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Profile update error: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_user_settings(self, user_id: int) -> Dict:
        """Get user settings"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM user_settings WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'gemini_api_keys': json.loads(result[2]) if result[2] else [],
                'ai_temperature': result[3],
                'ai_top_p': result[4],
                'theme': result[5],
                'units': result[6],
                'notifications_enabled': bool(result[7])
            }
        return {}
    
    def update_user_settings(self, user_id: int, settings_data: Dict) -> bool:
        """Update user settings"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Check if settings exist
            cursor.execute('SELECT * FROM user_settings WHERE user_id = ?', (user_id,))
            current = cursor.fetchone()
            
            if current:
                # Get current values to preserve existing data
                current_keys = json.loads(current[2]) if current[2] else []
                
                cursor.execute('''
                    UPDATE user_settings 
                    SET gemini_api_keys = COALESCE(?, gemini_api_keys), 
                        ai_temperature = COALESCE(?, ai_temperature), 
                        ai_top_p = COALESCE(?, ai_top_p), 
                        theme = COALESCE(?, theme), 
                        units = COALESCE(?, units), 
                        notifications_enabled = COALESCE(?, notifications_enabled)
                    WHERE user_id = ?
                ''', (
                    json.dumps(settings_data.get('gemini_api_keys')) if 'gemini_api_keys' in settings_data else None,
                    settings_data.get('ai_temperature') if 'ai_temperature' in settings_data else None,
                    settings_data.get('ai_top_p') if 'ai_top_p' in settings_data else None,
                    settings_data.get('theme') if 'theme' in settings_data else None,
                    settings_data.get('units') if 'units' in settings_data else None,
                    settings_data.get('notifications_enabled') if 'notifications_enabled' in settings_data else None,
                    user_id
                ))
            else:
                # Create new settings if doesn't exist
                cursor.execute('''
                    INSERT INTO user_settings (user_id, gemini_api_keys, ai_temperature, ai_top_p, theme, units, notifications_enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    json.dumps(settings_data.get('gemini_api_keys', [])),
                    settings_data.get('ai_temperature', 0.5),
                    settings_data.get('ai_top_p', 0.9),
                    settings_data.get('theme', 'dark'),
                    settings_data.get('units', 'metric'),
                    settings_data.get('notifications_enabled', True)
                ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Settings update error: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def store_recommendations(self, user_id: int, recommendations_data: Dict) -> bool:
        """Store AI-generated recommendations"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Delete existing recommendations for this user
            cursor.execute('DELETE FROM recommendations WHERE user_id = ?', (user_id,))
            
            # Insert new recommendations - handle both old and new format
            if 'food_recommendations' in recommendations_data or 'nutritional_analysis' in recommendations_data:
                # New enhanced format - store entire data structure
                cursor.execute('''
                    INSERT INTO recommendations (user_id, recommendations_data, overall_assessment, weekly_goal)
                    VALUES (?, ?, ?, ?)
                ''', (
                    user_id,
                    json.dumps(recommendations_data),
                    recommendations_data.get('overall_assessment', ''),
                    recommendations_data.get('weekly_goal', '')
                ))
            else:
                # Legacy format
                cursor.execute('''
                    INSERT INTO recommendations (user_id, recommendations_data, overall_assessment, weekly_goal)
                    VALUES (?, ?, ?, ?)
                ''', (
                    user_id,
                    json.dumps(recommendations_data.get('recommendations', [])),
                    recommendations_data.get('overall_assessment', ''),
                    recommendations_data.get('weekly_goal', '')
                ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Recommendations storage error: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_stored_recommendations(self, user_id: int) -> Dict:
        """Get stored recommendations for user"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT recommendations_data, overall_assessment, weekly_goal, created_at
            FROM recommendations 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        ''', (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            recommendations_data = json.loads(result[0]) if result[0] else {}
            
            # Check if it's the new enhanced format
            if isinstance(recommendations_data, dict) and ('food_recommendations' in recommendations_data or 'nutritional_analysis' in recommendations_data):
                # New enhanced format - return as is with metadata
                recommendations_data['overall_assessment'] = result[1]
                recommendations_data['weekly_goal'] = result[2]
                recommendations_data['created_at'] = result[3]
                return recommendations_data
            else:
                # Legacy format
                return {
                    'recommendations': recommendations_data if isinstance(recommendations_data, list) else [],
                    'overall_assessment': result[1],
                    'weekly_goal': result[2],
                    'created_at': result[3]
                }
        return None
    
    def get_user_goals(self, user_id: int) -> Dict:
        """Get user nutrition goals"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM user_goals WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', (user_id,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'goal_description': result[2],
                'daily_calories': result[3],
                'daily_protein': result[4],
                'daily_carbs': result[5],
                'daily_fat': result[6],
                'updated_at': result[8]
            }
        return {}
    
    def update_user_goals(self, user_id: int, goals_data: Dict) -> bool:
        """Update user nutrition goals"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Check if goals exist
            cursor.execute('SELECT id FROM user_goals WHERE user_id = ?', (user_id,))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing goals
                cursor.execute('''
                    UPDATE user_goals 
                    SET goal_description = ?, 
                        daily_calories = ?, 
                        daily_protein = ?, 
                        daily_carbs = ?, 
                        daily_fat = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                ''', (
                    goals_data.get('goal_description'),
                    goals_data.get('daily_calories'),
                    goals_data.get('daily_protein'),
                    goals_data.get('daily_carbs'),
                    goals_data.get('daily_fat'),
                    user_id
                ))
            else:
                # Create new goals
                cursor.execute('''
                    INSERT INTO user_goals (user_id, goal_description, daily_calories, daily_protein, daily_carbs, daily_fat)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    goals_data.get('goal_description'),
                    goals_data.get('daily_calories'),
                    goals_data.get('daily_protein'),
                    goals_data.get('daily_carbs'),
                    goals_data.get('daily_fat')
                ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Goals update error: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()