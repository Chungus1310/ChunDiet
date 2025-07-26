import os
import json
import logging
from google import genai
from google.genai import types
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiNutritionAnalyzer:
    def __init__(self):
        self.client = None
        self.model = "gemini-2.5-flash"
        self.api_keys = []
        self.current_key_index = 0
        
    def set_api_keys(self, api_keys):
        """Set multiple API keys for rotation"""
        self.api_keys = api_keys
        self.current_key_index = 0
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Gemini client with current API key"""
        if self.api_keys:
            api_key = self.api_keys[self.current_key_index]
        else:
            api_key = os.environ.get("GEMINI_API_KEY")
        
        if api_key:
            self.client = genai.Client(api_key=api_key)
        else:
            raise ValueError("No Gemini API key available")
    
    def _rotate_api_key(self):
        """Rotate to next API key if available"""
        if len(self.api_keys) > 1:
            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
            self._initialize_client()
            return True
        return False
    
    def analyze_meal(self, meal_description, consumption_time=None, temperature=0.5):
        """
        Analyze meal description using Gemini API
        Returns structured nutrition data
        """
        logger.info(f"[MEAL ANALYSIS] REQUEST")
        logger.info(f"Description: {meal_description}")
        logger.info(f"Time: {consumption_time}")
        logger.info(f"Temperature: {temperature}")
        
        if not self.client:
            self._initialize_client()
        
        # Prepare input text with expert prompt engineering
        time_context = ""
        if consumption_time:
            time_context = f" consumed at {consumption_time}"
        
        input_text = f"""You are Chun, an expert nutritionist and registered dietitian with over 15 years of experience in food analysis and nutritional assessment. You have extensive knowledge of food composition databases, portion sizes, and nutritional values across different cuisines and cooking methods.

Your task is to analyze the following meal description and provide accurate, detailed nutritional information:

Meal Description: "{meal_description}"{time_context}

Please analyze this meal with the precision of a professional nutritionist, considering:
- Standard serving sizes and portions
- Cooking methods that may affect nutritional content
- Common ingredients and their nutritional profiles
- Regional variations in food preparation

Provide comprehensive nutritional analysis including macronutrients, micronutrients, and key vitamins/minerals."""
        
        logger.info(f"[PROMPT] SENT TO LLM:")
        logger.info(f"{input_text}")
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=input_text),
                ],
            ),
        ]
        
        generate_content_config = types.GenerateContentConfig(
            temperature=temperature,
            thinking_config=types.ThinkingConfig(
                thinking_budget=10587,
            ),
            media_resolution="MEDIA_RESOLUTION_MEDIUM",
            response_mime_type="application/json",
            response_schema=self._get_nutrition_schema(),
        )
        
        try:
            response_text = ""
            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            ):
                response_text += chunk.text
            
            logger.info(f"[LLM RESPONSE] Raw:")
            logger.info(f"{response_text}")
            
            parsed_response = json.loads(response_text)
            
            logger.info(f"[PARSED DATA] Nutrition Analysis:")
            logger.info(f"Food Item: {parsed_response.get('food_item', 'N/A')}")
            logger.info(f"Calories: {parsed_response.get('nutritional_values', {}).get('calories', 'N/A')}")
            logger.info(f"Protein: {parsed_response.get('nutritional_values', {}).get('protein', 'N/A')}")
            logger.info(f"Carbs: {parsed_response.get('nutritional_values', {}).get('carbohydrates', {}).get('total', 'N/A')}")
            logger.info(f"Fat: {parsed_response.get('nutritional_values', {}).get('fat', {}).get('total', 'N/A')}")
            logger.info(f"Vitamins: {len(parsed_response.get('nutritional_values', {}).get('vitamins', []))} items")
            
            return parsed_response
        
        except Exception as e:
            logger.error(f"[ERROR] MEAL ANALYSIS ERROR: {str(e)}")
            # Try rotating API key if available
            if self._rotate_api_key():
                logger.info("[RETRY] Retrying with rotated API key...")
                return self.analyze_meal(meal_description, consumption_time, temperature)
            else:
                raise Exception(f"Gemini API error: {str(e)}")
    
    def generate_recommendations(self, recent_nutrition_data, user_profile, user_goals=None, temperature=0.7):
        """Generate personalized nutrition recommendations"""
        
        logger.info(f"[RECOMMENDATIONS] GENERATION REQUEST")
        logger.info(f"User Profile: {user_profile}")
        logger.info(f"User Goals: {user_goals}")
        logger.info(f"Temperature: {temperature}")
        
        # Format today's meals
        today_meals_text = ""
        if recent_nutrition_data.get('today_meals'):
            today_meals_text = "TODAY'S MEALS:\n"
            for meal in recent_nutrition_data['today_meals']:
                today_meals_text += f"- {meal['food_item']} at {meal['consumption_time']}\n"
                today_meals_text += f"  Calories: {meal['calories']}, Protein: {meal['protein']}, Carbs: {meal['carbohydrates']}, Fat: {meal['fat']}\n"
                if meal['vitamins']:
                    vitamins_str = ", ".join([f"{v['name']}: {v['percent_daily_value']}" for v in meal['vitamins']])
                    today_meals_text += f"  Key vitamins/minerals: {vitamins_str}\n"
                today_meals_text += "\n"
        else:
            today_meals_text = "TODAY'S MEALS: No meals logged today\n\n"
        
        # Format previous week's meals
        previous_meals_text = ""
        if recent_nutrition_data.get('previous_meals'):
            previous_meals_text = "PREVIOUS WEEK'S MEALS:\n"
            current_date = None
            for meal in recent_nutrition_data['previous_meals']:
                if current_date != meal['date']:
                    current_date = meal['date']
                    previous_meals_text += f"\n{current_date}:\n"
                previous_meals_text += f"- {meal['food_item']} at {meal['consumption_time']}\n"
                previous_meals_text += f"  Calories: {meal['calories']}, Protein: {meal['protein']}, Carbs: {meal['carbohydrates']}, Fat: {meal['fat']}\n"
                if meal['vitamins']:
                    vitamins_str = ", ".join([f"{v['name']}: {v['percent_daily_value']}" for v in meal['vitamins']])
                    previous_meals_text += f"  Key vitamins/minerals: {vitamins_str}\n"
        else:
            previous_meals_text = "PREVIOUS WEEK'S MEALS: No previous meals found\n"
        
        logger.info(f"[DATA SUMMARY] Nutrition Overview:")
        logger.info(f"Today's meals: {len(recent_nutrition_data.get('today_meals', []))}")
        logger.info(f"Previous meals: {len(recent_nutrition_data.get('previous_meals', []))}")
        logger.info(f"Days with data: {recent_nutrition_data.get('days_with_data', 0)} out of {recent_nutrition_data.get('period_days', 7)}")
        logger.info(f"Total calories: {recent_nutrition_data.get('total_calories', 0)}")
        logger.info(f"Avg daily calories: {recent_nutrition_data.get('avg_daily_calories', 0):.0f}")
        logger.info(f"Total meals: {recent_nutrition_data.get('total_meals', 0)}")
        logger.info(f"Food variety: {recent_nutrition_data.get('food_variety', 0)}")
        
        prompt = f"""You are Chun, a certified nutritionist and wellness coach with expertise in personalized nutrition planning, metabolic health, and sustainable dietary habits. You have helped thousands of clients achieve their health goals through evidence-based nutrition guidance.

Your client has been tracking their nutrition, and you need to provide personalized recommendations based on their profile and detailed eating patterns.

CLIENT PROFILE:
- Age: {user_profile.get('age', 'Not specified')}
- Gender: {user_profile.get('gender', 'Not specified')}
- Weight: {user_profile.get('weight', 'Not specified')}kg
- Activity Level: {user_profile.get('activity_level', 'Not specified')}

CLIENT NUTRITION GOALS:
- Goal Description: {user_goals.get('goal_description', 'Not set by user') if user_goals else 'Not set by user'}
- Daily Calorie Target: {user_goals.get('daily_calories', 'Not set by user') if user_goals else 'Not set by user'}
- Daily Protein Target: {user_goals.get('daily_protein', 'Not set by user') if user_goals else 'Not set by user'}g
- Daily Carbs Target: {user_goals.get('daily_carbs', 'Not set by user') if user_goals else 'Not set by user'}g
- Daily Fat Target: {user_goals.get('daily_fat', 'Not set by user') if user_goals else 'Not set by user'}g

NUTRITION ANALYSIS DATA:
- Data availability: {recent_nutrition_data.get('days_with_data', 0)} days with logged meals out of past {recent_nutrition_data.get('period_days', 7)} days
- Total calories logged: {recent_nutrition_data.get('total_calories', 0)} calories across all logged days
- Average daily calories: {recent_nutrition_data.get('avg_daily_calories', 0):.0f} calories (calculated from {recent_nutrition_data.get('days_with_data', 0)} days with data)
- Total meals logged: {recent_nutrition_data.get('total_meals', 0)}
- Food variety: {recent_nutrition_data.get('food_variety', 0)} different foods

{today_meals_text}

{previous_meals_text}

COMPREHENSIVE NUTRITION ANALYSIS TASK:

IMPORTANT: The user has logged meals for {recent_nutrition_data.get('days_with_data', 0)} out of the past {recent_nutrition_data.get('period_days', 7)} days. Base your analysis on the ACTUAL data available, not assumptions about missing days. If data is limited, acknowledge this in your assessment and focus on patterns from available data.

As their expert nutritionist, provide a detailed analysis covering:

1. **OVERALL ASSESSMENT**: Summarize their current nutritional status, eating patterns, and overall health trajectory. IMPORTANT: Acknowledge the data completeness ({recent_nutrition_data.get('days_with_data', 0)} days of data) and base conclusions only on available information.

2. **NUTRITIONAL ANALYSIS**: Break down their nutrition into:
   - Calorie analysis (adequacy, distribution, timing) - base this on the {recent_nutrition_data.get('days_with_data', 0)} days with actual data
   - Macronutrient balance (protein, carbs, fats ratios and quality) from logged meals
   - Micronutrient status (vitamins, minerals from their actual intake)
   - Identify specific deficiencies and nutritional strengths from available data

3. **FOOD RECOMMENDATIONS**: Suggest 4-6 specific foods for different meals:
   - Include meal type (breakfast/lunch/dinner/snack)
   - Explain health benefits and nutrients provided
   - Give practical preparation tips

4. **DIET RECOMMENDATIONS**: Provide 3-4 dietary pattern suggestions:
   - Focus on meal timing, portion control, food combinations
   - Address their specific nutritional gaps
   - Include practical implementation strategies

5. **INGREDIENT RECOMMENDATIONS**: Suggest 4-5 key ingredients to address deficiencies:
   - Specify which nutrients they provide
   - Explain health benefits
   - Give usage suggestions and daily amounts

6. **NEXT DAY MEAL PLAN**: Create a detailed plan for tomorrow:
   - Specific breakfast, lunch, dinner suggestions
   - Focus nutrients for each meal
   - Healthy snack options

7. **WEEKLY GOAL**: One achievable goal for the week
8. **HYDRATION REMINDER**: Personalized hydration advice

Make all recommendations:
- Specific to their actual nutritional data and deficiencies
- Culturally appropriate and practical
- Evidence-based and health-focused
- Encouraging and sustainable
- Focused on nutrient density and variety"""
        
        logger.info(f"[PROMPT] RECOMMENDATION PROMPT SENT TO LLM:")
        logger.info(f"{prompt}")
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                ],
            ),
        ]
        
        config = types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=genai.types.Schema(
                type=genai.types.Type.OBJECT,
                properties={
                    "overall_assessment": genai.types.Schema(type=genai.types.Type.STRING),
                    "nutritional_analysis": genai.types.Schema(
                        type=genai.types.Type.OBJECT,
                        properties={
                            "calorie_analysis": genai.types.Schema(type=genai.types.Type.STRING),
                            "macronutrient_balance": genai.types.Schema(type=genai.types.Type.STRING),
                            "micronutrient_status": genai.types.Schema(type=genai.types.Type.STRING),
                            "deficiencies": genai.types.Schema(
                                type=genai.types.Type.ARRAY,
                                items=genai.types.Schema(type=genai.types.Type.STRING)
                            ),
                            "strengths": genai.types.Schema(
                                type=genai.types.Type.ARRAY,
                                items=genai.types.Schema(type=genai.types.Type.STRING)
                            )
                        }
                    ),
                    "food_recommendations": genai.types.Schema(
                        type=genai.types.Type.ARRAY,
                        items=genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            properties={
                                "meal_type": genai.types.Schema(type=genai.types.Type.STRING),
                                "food_name": genai.types.Schema(type=genai.types.Type.STRING),
                                "benefits": genai.types.Schema(type=genai.types.Type.STRING),
                                "nutrients_provided": genai.types.Schema(
                                    type=genai.types.Type.ARRAY,
                                    items=genai.types.Schema(type=genai.types.Type.STRING)
                                ),
                                "preparation_tip": genai.types.Schema(type=genai.types.Type.STRING)
                            }
                        )
                    ),
                    "diet_recommendations": genai.types.Schema(
                        type=genai.types.Type.ARRAY,
                        items=genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            properties={
                                "category": genai.types.Schema(type=genai.types.Type.STRING),
                                "recommendation": genai.types.Schema(type=genai.types.Type.STRING),
                                "rationale": genai.types.Schema(type=genai.types.Type.STRING),
                                "implementation": genai.types.Schema(type=genai.types.Type.STRING)
                            }
                        )
                    ),
                    "ingredient_recommendations": genai.types.Schema(
                        type=genai.types.Type.ARRAY,
                        items=genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            properties={
                                "ingredient": genai.types.Schema(type=genai.types.Type.STRING),
                                "nutrient_focus": genai.types.Schema(type=genai.types.Type.STRING),
                                "health_benefits": genai.types.Schema(type=genai.types.Type.STRING),
                                "usage_suggestions": genai.types.Schema(
                                    type=genai.types.Type.ARRAY,
                                    items=genai.types.Schema(type=genai.types.Type.STRING)
                                ),
                                "daily_amount": genai.types.Schema(type=genai.types.Type.STRING)
                            }
                        )
                    ),
                    "next_day_plan": genai.types.Schema(
                        type=genai.types.Type.OBJECT,
                        properties={
                            "breakfast": genai.types.Schema(
                                type=genai.types.Type.OBJECT,
                                properties={
                                    "suggestion": genai.types.Schema(type=genai.types.Type.STRING),
                                    "focus_nutrients": genai.types.Schema(
                                        type=genai.types.Type.ARRAY,
                                        items=genai.types.Schema(type=genai.types.Type.STRING)
                                    )
                                }
                            ),
                            "lunch": genai.types.Schema(
                                type=genai.types.Type.OBJECT,
                                properties={
                                    "suggestion": genai.types.Schema(type=genai.types.Type.STRING),
                                    "focus_nutrients": genai.types.Schema(
                                        type=genai.types.Type.ARRAY,
                                        items=genai.types.Schema(type=genai.types.Type.STRING)
                                    )
                                }
                            ),
                            "dinner": genai.types.Schema(
                                type=genai.types.Type.OBJECT,
                                properties={
                                    "suggestion": genai.types.Schema(type=genai.types.Type.STRING),
                                    "focus_nutrients": genai.types.Schema(
                                        type=genai.types.Type.ARRAY,
                                        items=genai.types.Schema(type=genai.types.Type.STRING)
                                    )
                                }
                            ),
                            "snacks": genai.types.Schema(
                                type=genai.types.Type.ARRAY,
                                items=genai.types.Schema(type=genai.types.Type.STRING)
                            )
                        }
                    ),
                    "weekly_goal": genai.types.Schema(type=genai.types.Type.STRING),
                    "hydration_reminder": genai.types.Schema(type=genai.types.Type.STRING)
                }
            )
        )
        
        try:
            response_text = ""
            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=config,
            ):
                response_text += chunk.text
            
            logger.info(f"[LLM RESPONSE] Recommendation Response (Raw):")
            logger.info(f"{response_text}")
            
            parsed_response = json.loads(response_text)
            
            logger.info(f"[PARSED RECOMMENDATIONS] Analysis Complete:")
            logger.info(f"Overall Assessment: {parsed_response.get('overall_assessment', 'N/A')[:100]}...")
            logger.info(f"Weekly Goal: {parsed_response.get('weekly_goal', 'N/A')[:100]}...")
            logger.info(f"Number of Recommendations: {len(parsed_response.get('recommendations', []))}")
            
            for i, rec in enumerate(parsed_response.get('recommendations', []), 1):
                logger.info(f"  {i}. {rec.get('title', 'No title')} ({rec.get('priority', 'N/A')} priority)")
            
            return parsed_response
        
        except Exception as e:
            logger.error(f"[ERROR] RECOMMENDATION GENERATION ERROR: {str(e)}")
            if self._rotate_api_key():
                logger.info("[RETRY] Retrying with rotated API key...")
                return self.generate_recommendations(recent_nutrition_data, user_profile, user_goals, temperature)
            else:
                raise Exception(f"Gemini API error: {str(e)}")
    
    def _get_nutrition_schema(self):
        """Return the nutrition analysis schema for Gemini API"""
        return genai.types.Schema(
            type=genai.types.Type.OBJECT,
            description="Schema for extracting nutritional information from a text query about food consumption.",
            properties={
                "food_item": genai.types.Schema(
                    type=genai.types.Type.STRING,
                    description="The specific food or dish identified from the user's query (e.g., 'apple pie', 'banana').",
                ),
                "consumption_time": genai.types.Schema(
                    type=genai.types.Type.STRING,
                    description="The ISO 8601 formatted date and time of consumption. This should be null if no time was mentioned in the query.",
                    format="date-time",
                ),
                "nutritional_values": genai.types.Schema(
                    type=genai.types.Type.OBJECT,
                    description="A detailed breakdown of the nutritional information for the identified food item per standard serving.",
                    properties={
                        "serving_size": genai.types.Schema(
                            type=genai.types.Type.STRING,
                            description="The standard serving size for which the nutritional values are provided (e.g., '1 slice (125g)', '1 medium banana').",
                        ),
                        "calories": genai.types.Schema(
                            type=genai.types.Type.INTEGER,
                            description="Total energy in kilocalories (kcal).",
                        ),
                        "protein": genai.types.Schema(
                            type=genai.types.Type.STRING,
                            description="Total protein content, including the unit (e.g., '4g').",
                        ),
                        "carbohydrates": genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            description="Breakdown of carbohydrate content.",
                            properties={
                                "total": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                    description="Total carbohydrates, including the unit (e.g., '58g').",
                                ),
                                "fiber": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                    description="Dietary fiber, including the unit (e.g., '2g').",
                                ),
                                "sugars": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                    description="Total sugars, including the unit (e.g., '25g').",
                                ),
                            },
                        ),
                        "fat": genai.types.Schema(
                            type=genai.types.Type.OBJECT,
                            description="Breakdown of fat content.",
                            properties={
                                "total": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                    description="Total fat, including the unit (e.g., '19g').",
                                ),
                                "saturated": genai.types.Schema(
                                    type=genai.types.Type.STRING,
                                    description="Saturated fat, including the unit (e.g., '9g').",
                                ),
                            },
                        ),
                        "vitamins": genai.types.Schema(
                            type=genai.types.Type.ARRAY,
                            description="A list of significant vitamins and minerals and their percentage of the recommended daily value (%DV).",
                            items=genai.types.Schema(
                                type=genai.types.Type.OBJECT,
                                properties={
                                    "name": genai.types.Schema(
                                        type=genai.types.Type.STRING,
                                        description="Name of the vitamin or mineral (e.g., 'Vitamin A', 'Iron').",
                                    ),
                                    "percent_daily_value": genai.types.Schema(
                                        type=genai.types.Type.STRING,
                                        description="The percentage of the recommended daily value, formatted as a string (e.g., '15%').",
                                    ),
                                },
                            ),
                        ),
                    },
                ),
            },
        )