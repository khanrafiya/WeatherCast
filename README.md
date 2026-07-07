
# WeatherCast 🌦️

A live weather application for India, built as part of a frontend development internship. WeatherCast auto-detects your location and provides real-time weather data along with a 5-day forecast for cities and areas across India — including detailed area-level coverage for Kanpur.

## Features

- 🌍 **Auto location detection** — automatically detects and shows weather for your current location
- 🔍 **City & area search** — search any Indian city, or browse popular areas across Kanpur, Lucknow, Noida, Gurgaon, Bangalore, Indore, and Rajasthan
- 📅 **5-day forecast** — hourly and daily weather predictions
- 🎨 **Dynamic weather animations** — full-screen animated backgrounds that change based on real-time conditions (sunny, rainy, cloudy, cold, thunderstorm)
- 📊 **Search history** — recently searched cities saved and displayed
- ⚡ **Live weather alerts** — contextual warnings for extreme heat, rain, or cold

## Tech Stack

- **Frontend:** React 19, TypeScript, TanStack Start, TanStack Router, TanStack Query
- **Styling:** Tailwind CSS v4
- **Backend:** Supabase (search history storage)
- **Weather Data:** OpenWeatherMap API
- **Package Manager:** Bun
- **Deployment:** Vercel

### Prerequisites

- [Bun](https://bun.sh) installed
- An [OpenWeatherMap API key](https://home.openweathermap.org/users/sign_up) (free tier)
- A [Supabase](https://supabase.com) project (for search history)
