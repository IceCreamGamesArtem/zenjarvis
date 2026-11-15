#!/usr/bin/env python3
"""ZenJarvis — бэкенд медитативного PWA.

Запуск:
    python meditation_app.py

Переменные окружения (все необязательные):
    OPENWEATHER_API_KEY  — ключ OpenWeatherMap; без него используется Open-Meteo.
    LLM_API_KEY          — ключ OpenAI-совместимого API для живых инструкций.
    LLM_BASE_URL         — по умолчанию https://api.openai.com/v1
    LLM_MODEL            — по умолчанию gpt-4o-mini
    HOST / PORT          — по умолчанию 0.0.0.0:5000
"""

from __future__ import annotations

import copy
import glob
import logging
import math
import os
import random
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from flask import Flask, Response, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web_app"
MUSIC_DIR = BASE_DIR / "music"

app = Flask(__name__, static_folder=str(WEB_DIR), static_url_path="")
app.json.ensure_ascii = False

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
LOGGER = logging.getLogger("zenjarvis")


def _redact_secrets(value: Any) -> str:
    """Не даёт ключам API попасть в журнал при ошибках HTTP."""
    text = str(value)
    return re.sub(
        r"(?i)\b(appid|api[_-]?key|token|authorization)=([^&\s]+)",
        r"\1=***",
        text,
    )

# ---------------------------------------------------------------------------
# Медитативные инструкции
# ---------------------------------------------------------------------------

MEDITATION_SYSTEM_PROMPT = (
    "Ты — инструктор по медитации. Ты даешь инструкции по одному предложению за раз, мягким голосом. "
    "Не пиши весь текст сразу.\n\n"
    "Формат ответа: только один короткий абзац на русском языке, 1–2 предложения, "
    "не длиннее 220 символов. Без приветствий, заголовков, списков, кавычек и пояснений. "
    "Обращайся к человеку на «вы», используй настоящее время и мягкие глаголы. "
    "Не обещай результат и не давай медицинских советов."
)

NSDR_SYSTEM_PROMPT = (
    "Ты — инструктор по нейрофизиологии. Проведи сессию NSDR (йога-нидра). "
    "Твоя задача — расслабить тело, но сохранить сознание ясным. "
    "Используй технику сканирования тела (от пальцев ног до макушки), дыхание и визуализацию. "
    "Говори мягко, но не давай уснуть. "
    "В конце дай инструкцию на бодрое пробуждение.\n\n"
    "Формат ответа: только один короткий абзац на русском языке, 1–2 предложения, "
    "не длиннее 220 символов. Без приветствий, заголовков, списков, кавычек и пояснений. "
    "Обращайся к человеку на «вы», используй настоящее время. "
    "Не давай медицинских диагнозов и обещаний. Не позволяй практике превратиться в сон."
)

FALLBACK_INSTRUCTIONS = {
    "arrive": [
        "Расслабьте плечи и мягко опустите их вниз. Сделайте спокойный вдох через нос.",
        "Почувствуйте опору под собой и позвольте телу стать чуть тяжелее.",
        "Закройте глаза, если это удобно, и заметьте естественный ритм своего дыхания.",
        "Сделайте глубокий вдох и медленный выдох. Не нужно ничего менять, просто наблюдайте.",
        "Позвольте лицу расслабиться: разгладьте лоб и мягко разожмите челюсть.",
    ],
    "breath": [
        "На вдохе почувствуйте прохладный воздух, а на выдохе — его мягкое тепло.",
        "Позвольте выдоху быть чуть длиннее вдоха, без усилия и напряжения.",
        "Заметьте, как живот мягко поднимается на вдохе и опускается на выдохе.",
        "Если мысли уводят вас, мягко верните внимание к следующему вдоху.",
        "Сделайте паузу после выдоха — всего на мгновение — и вдохните снова.",
    ],
    "body": [
        "Перенесите внимание в стопы и заметьте, как они касаются пола.",
        "Почувствуйте кисти рук и позвольте пальцам расслабиться.",
        "Пройдите вниманием от плеч к предплечьям и заметьте любое напряжение.",
        "Услышьте звуки вокруг себя, не оценивая их и не пытаясь назвать.",
        "Почувствуйте, как дыхание само находит удобный ему ритм.",
    ],
    "closing": [
        "Сделайте более глубокий вдох и позвольте телу наполниться спокойствием.",
        "Мягко верните внимание в комнату и почувствуйте поверхность под собой.",
        "Не спешите открывать глаза. Побудьте ещё несколько мгновений в тишине.",
        "Сделайте последний спокойный выдох и сохраните это ощущение с собой.",
        "Поблагодарите себя за эти минуты внимания и мягко возвращайтесь.",
    ],
}

NSDR_FALLBACK_INSTRUCTIONS = {
    "settle": [
        "Лягте удобно и почувствуйте, как тело принимает вес опоры.",
        "Сделайте спокойный вдох и мягкий выдох. Глаза можно закрыть, но сохраняйте ясность.",
        "Заметьте звуки вокруг и позвольте им остаться на фоне.",
        "Почувствуйте, что вам не нужно никуда спешить в следующие пятнадцать минут.",
    ],
    "legs": [
        "Перенесите внимание к пальцам ног и заметьте их прохладу или тепло.",
        "Почувствуйте стопы целиком, расслабьте своды и позвольте пяткам стать тяжелее.",
        "Мягко пройдите вниманием через голени и отпустите напряжение в икрах.",
        "Заметьте колени и бёдра, позвольте им расслабиться без усилия.",
        "Почувствуйте, как ноги становятся спокойными и тёплыми, а внимание остаётся бодрым.",
    ],
    "torso": [
        "Перенесите внимание в живот и заметьте, как он мягко двигается на вдохе.",
        "Почувствуйте спину и позвольте ей стать шире на опоре.",
        "Расслабьте плечи и отпустите их вниз, сохраняя внимание ясным.",
        "Пройдите вниманием через кисти рук и позвольте пальцам расслабиться.",
        "Заметьте челюсть и мягко разожмите зубы, не теряя бодрствования.",
    ],
    "head": [
        "Почувствуйте шею и позвольте ей удлиниться без напряжения.",
        "Перенесите внимание к лицу, разгладьте лоб и расслабьте глаза.",
        "Заметьте кожу головы и макушку, словно мягкий свет касается её.",
        "Пройдите вниманием от макушки к плечам и обратно, сохраняя тело расслабленным.",
    ],
    "visual": [
        "Представьте спокойное светлое пространство, в котором легко дышится.",
        "Позвольте этому пространству наполнить тело мягким светом и ясностью.",
        "Заметьте, как дыхание становится ровным, а мысли — тише, но не исчезают.",
        "Останьтесь здесь на несколько вдохов, сохраняя внимание живым и собранным.",
    ],
    "wake": [
        "Сделайте вдох чуть глубже и почувствуйте, как возвращается тонус.",
        "Почувствуйте пальцы рук и ног, мягко верните движение в тело.",
        "Сделайте ещё один спокойный вдох и приготовьтесь открыть глаза.",
        "Откройте глаза, сядьте и позвольте ясности остаться с вами.",
    ],
}


def _fallback_instruction(elapsed: int, duration: int = 300, mode: str = "meditation") -> str:
    """Локальная инструкция на случай, если LLM не настроена или недоступна."""
    progress = elapsed / max(1, duration)
    if mode == "nsdr":
        if progress < 0.08:
            phase = "settle"
        elif progress < 0.3:
            phase = "legs"
        elif progress < 0.52:
            phase = "torso"
        elif progress < 0.72:
            phase = "head"
        elif progress < 0.9:
            phase = "visual"
        else:
            phase = "wake"
        return random.choice(NSDR_FALLBACK_INSTRUCTIONS[phase])

    if progress < 0.15:
        phase = "arrive"
    elif progress < 0.55:
        phase = "breath"
    elif progress < 0.83:
        phase = "body"
    else:
        phase = "closing"
    return random.choice(FALLBACK_INSTRUCTIONS[phase])


def _clean_instruction(value: Any) -> str:
    """Приводит ответ модели к одному аккуратному абзацу без разметки."""
    if not isinstance(value, str):
        return ""

    text = re.sub(r"```.*?```", " ", value, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", text)
    text = text.replace("**", "").replace("__", "").replace("*", "").replace("`", "")
    text = re.sub(r"^\s*#{1,6}\s*", "", text)
    text = re.sub(r"^(?:Инструкция|Ответ)\s*:\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip().strip('"«»“”')

    if not text:
        return ""

    sentences = [part.strip() for part in re.split(r"(?<=[.!?…])\s+", text) if part.strip()]
    text = " ".join(sentences[:2]).strip()

    if len(text) > 240:
        shortened = text[:240]
        last_stop = max(
            shortened.rfind("."),
            shortened.rfind("!"),
            shortened.rfind("?"),
            shortened.rfind("…"),
        )
        if last_stop >= 80:
            text = shortened[: last_stop + 1]
        else:
            text = shortened.rsplit(" ", 1)[0].rstrip(" ,;:—-") + "…"

    return text


def _llm_config() -> dict[str, str]:
    return {
        "api_key": (os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip(),
        "base_url": (os.getenv("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/"),
        "model": (os.getenv("LLM_MODEL") or "gpt-4o-mini").strip(),
    }


def _request_llm_instruction(
    elapsed: int,
    remaining: int,
    duration: int,
    mode: str = "meditation",
) -> str:
    """Запрашивает у OpenAI-совместимого API одну короткую реплику."""
    config = _llm_config()
    if not config["api_key"]:
        return ""

    duration_minutes = max(1, round(duration / 60))
    elapsed_minutes = max(0, elapsed // 60)
    remaining_minutes = max(0, remaining // 60)
    if mode == "nsdr":
        user_prompt = (
            f"Идёт {duration_minutes}-минутная NSDR-сессия. "
            f"Прошло примерно {elapsed_minutes} минут, осталось примерно {remaining_minutes} минут. "
            "Продолжи сканирование тела от пальцев ног к макушке, сохраняя сознание ясным. "
            "Дай один следующий шаг. Только текст реплики, без пояснений."
        )
        system_prompt = NSDR_SYSTEM_PROMPT
    else:
        user_prompt = (
            f"Идёт медитация длительностью {duration_minutes} минут. "
            f"Прошло примерно {elapsed_minutes} минут, осталось примерно {remaining_minutes} минут. "
            "Дай одну следующую инструкцию, которая логично продолжает практику. "
            "Только текст реплики, без пояснений."
        )
        system_prompt = MEDITATION_SYSTEM_PROMPT

    try:
        response = requests.post(
            f"{config['base_url']}/chat/completions",
            headers={
                "Authorization": f"Bearer {config['api_key']}",
                "Content-Type": "application/json",
                "User-Agent": "ZenJarvis/1.0",
            },
            json={
                "model": config["model"],
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.8,
                "max_tokens": 90,
            },
            timeout=(3.05, 10),
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = " ".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            )
        return _clean_instruction(content)
    except Exception as exc:  # noqa: BLE001 - медитация не должна падать из-за LLM
        LOGGER.warning("LLM request failed, using a local instruction: %s", _redact_secrets(exc))
        return ""


def _meditation_payload(
    elapsed: int,
    duration: int,
    mode: str = "meditation",
) -> tuple[str, str]:
    """Возвращает текст инструкции и источник (llm / fallback)."""
    remaining = max(0, duration - elapsed)
    text = _request_llm_instruction(elapsed, remaining, duration, mode)
    if text and len(text) >= 12:
        return text, "llm"
    return _fallback_instruction(elapsed, duration, mode), "fallback"


# ---------------------------------------------------------------------------
# Погода и музыка
# ---------------------------------------------------------------------------

AUDIO_EXTENSIONS = {
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".wav",
    ".flac",
}

# Windows иногда определяет .aac как audio/vnd.dlna.adts, который браузер
# отказывается воспроизводить. MIME-типы задаются явно для всех форматов.
AUDIO_MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
}


def _music_candidates() -> list[Path]:
    """Рекурсивно собирает поддерживаемые аудиофайлы из music/."""
    if not MUSIC_DIR.is_dir():
        return []

    candidates: list[Path] = []
    for raw_path in glob.glob(str(MUSIC_DIR / "**" / "*"), recursive=True):
        path = Path(raw_path)
        if not path.is_file() or path.suffix.casefold() not in AUDIO_EXTENSIONS:
            continue
        try:
            relative = path.relative_to(MUSIC_DIR)
        except ValueError:
            continue
        if any(part.startswith(".") for part in relative.parts):
            continue
        candidates.append(path)

    return sorted(candidates, key=lambda path: path.as_posix().casefold())


def _music_payload(path: Path) -> dict[str, Any]:
    """Публичное описание выбранного файла для фронтенда."""
    relative = path.relative_to(MUSIC_DIR).as_posix()
    title = re.sub(r"[_]+", " ", path.stem)
    title = re.sub(r"\s+", " ", title).strip() or path.name
    suffix = path.suffix.casefold()
    return {
        "available": True,
        "file": "/music/" + quote(relative, safe="/"),
        "filename": path.name,
        "title": title,
        "mime_type": AUDIO_MIME_TYPES.get(suffix, "application/octet-stream"),
    }


def _requested_track(requested: str, files: list[Path]) -> Path | None:
    """Находит выбранный пользователем файл без доступа к произвольным путям."""
    name = requested.strip()
    if not name:
        return None

    for path in files:
        relative = path.relative_to(MUSIC_DIR).as_posix()
        if relative == name or path.name == name:
            return path

    folded = name.casefold()
    for path in files:
        relative = path.relative_to(MUSIC_DIR).as_posix()
        if path.name.casefold() == folded or relative.casefold() == folded:
            return path
    return None


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if math.isfinite(value) else default


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return max(minimum, value)


DEFAULT_LAT = _env_float("DEFAULT_LAT", 55.7558)
DEFAULT_LON = _env_float("DEFAULT_LON", 37.6173)
DEFAULT_CITY = os.getenv("DEFAULT_CITY", "Москва")
WEATHER_CACHE_TTL = _env_int("WEATHER_CACHE_TTL", 600, minimum=60)

_weather_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
_weather_cache_lock = threading.Lock()


def _normalise_condition(raw: str) -> str:
    raw = (raw or "").strip().lower()
    if raw in {"clear", "sunny"}:
        return "sunny"
    if raw in {
        "clouds",
        "cloudy",
        "partly-cloudy",
        "overcast",
        "mist",
        "fog",
        "haze",
        "smoke",
        "dust",
        "sand",
        "ash",
    }:
        return "cloudy"
    if raw in {"rain", "drizzle", "showers"}:
        return "rainy"
    if raw in {"snow", "snowy"}:
        return "snowy"
    if raw in {"thunderstorm", "storm", "stormy", "tornado"}:
        return "stormy"
    return "unknown"


def _unavailable_weather() -> dict[str, Any]:
    return {
        "condition": "unknown",
        "description": "Погода недоступна",
        "temperature": None,
        "feels_like": None,
        "city": DEFAULT_CITY,
        "is_day": None,
        "available": False,
        "source": "fallback",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _fetch_openweather(lat: float, lon: float) -> dict[str, Any]:
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OpenWeatherMap key is not configured")

    response = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={
            "lat": lat,
            "lon": lon,
            "appid": api_key,
            "units": "metric",
            "lang": "ru",
        },
        headers={"User-Agent": "ZenJarvis/1.0"},
        timeout=(3.05, 7),
    )
    response.raise_for_status()
    data = response.json()
    weather = data["weather"][0]
    main = data.get("main", {})
    sys_data = data.get("sys", {})

    is_day = None
    if data.get("dt") and sys_data.get("sunrise") and sys_data.get("sunset"):
        is_day = sys_data["sunrise"] <= data["dt"] <= sys_data["sunset"]

    return {
        "condition": _normalise_condition(weather.get("main", "")),
        "description": str(weather.get("description") or "Погода").strip().capitalize(),
        "temperature": round(float(main["temp"]), 1) if main.get("temp") is not None else None,
        "feels_like": round(float(main["feels_like"]), 1) if main.get("feels_like") is not None else None,
        "city": str(data.get("name") or DEFAULT_CITY),
        "is_day": is_day,
        "available": True,
        "source": "openweathermap",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


WMO_DESCRIPTIONS = {
    0: "Ясно",
    1: "Преимущественно ясно",
    2: "Переменная облачность",
    3: "Пасмурно",
    45: "Туман",
    48: "Изморозь и туман",
    51: "Слабая морось",
    53: "Морось",
    55: "Сильная морось",
    56: "Ледяная морось",
    57: "Сильная ледяная морось",
    61: "Небольшой дождь",
    63: "Дождь",
    65: "Сильный дождь",
    66: "Ледяной дождь",
    67: "Сильный ледяной дождь",
    71: "Небольшой снег",
    73: "Снег",
    75: "Сильный снег",
    77: "Снежные зёрна",
    80: "Небольшие ливни",
    81: "Ливни",
    82: "Сильные ливни",
    85: "Снежные ливни",
    86: "Сильные снежные ливни",
    95: "Гроза",
    96: "Гроза с градом",
    99: "Сильная гроза с градом",
}


def _condition_from_wmo(code: int | None) -> str:
    if code is None:
        return "unknown"
    if code == 0:
        return "sunny"
    if code in {1, 2, 3, 45, 48}:
        return "cloudy"
    if code in {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}:
        return "rainy"
    if code in {71, 73, 75, 77, 85, 86}:
        return "snowy"
    if code in {95, 96, 99}:
        return "stormy"
    return "unknown"


def _fetch_open_meteo(lat: float, lon: float) -> dict[str, Any]:
    response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,apparent_temperature,is_day,weather_code",
            "timezone": "auto",
            "forecast_days": 1,
        },
        headers={"User-Agent": "ZenJarvis/1.0"},
        timeout=(3.05, 7),
    )
    response.raise_for_status()
    data = response.json()
    current = data["current"]
    code = current.get("weather_code")
    if code is not None:
        code = int(code)

    return {
        "condition": _condition_from_wmo(code),
        "description": WMO_DESCRIPTIONS.get(code, "Погода"),
        "temperature": (
            round(float(current["temperature_2m"]), 1)
            if current.get("temperature_2m") is not None
            else None
        ),
        "feels_like": (
            round(float(current["apparent_temperature"]), 1)
            if current.get("apparent_temperature") is not None
            else None
        ),
        "city": DEFAULT_CITY,
        "is_day": bool(current["is_day"]) if current.get("is_day") is not None else None,
        "available": True,
        "source": "open-meteo",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _get_weather(lat: float, lon: float) -> dict[str, Any]:
    cache_key = (round(lat, 2), round(lon, 2))
    now = time.monotonic()

    with _weather_cache_lock:
        cached = _weather_cache.get(cache_key)
        if cached and now - cached[0] < WEATHER_CACHE_TTL:
            return copy.deepcopy(cached[1])

    weather: dict[str, Any] | None = None

    if os.getenv("OPENWEATHER_API_KEY", "").strip():
        try:
            weather = _fetch_openweather(lat, lon)
        except Exception as exc:  # noqa: BLE001 - переходим к Open-Meteo
            LOGGER.warning("OpenWeatherMap request failed: %s", _redact_secrets(exc))

    if weather is None:
        try:
            weather = _fetch_open_meteo(lat, lon)
        except Exception as exc:  # noqa: BLE001 - приложение продолжит без погоды
            LOGGER.warning("Open-Meteo request failed: %s", _redact_secrets(exc))

    if weather is None:
        weather = _unavailable_weather()

    ttl = WEATHER_CACHE_TTL if weather["available"] else min(60, WEATHER_CACHE_TTL)
    with _weather_cache_lock:
        _weather_cache[cache_key] = (now, weather)
    return copy.deepcopy(weather)


# ---------------------------------------------------------------------------
# HTTP API и статические файлы PWA
# ---------------------------------------------------------------------------


def _bounded_int(value: Any, minimum: int, maximum: int, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, number))


def _json_response(payload: Any, status: int = 200) -> Response:
    response = jsonify(payload)
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    return response


def _coords_from_query() -> tuple[float, float]:
    try:
        lat = float(request.args.get("lat", DEFAULT_LAT))
        lon = float(request.args.get("lon", DEFAULT_LON))
    except (TypeError, ValueError):
        return DEFAULT_LAT, DEFAULT_LON

    if not (math.isfinite(lat) and math.isfinite(lon)):
        return DEFAULT_LAT, DEFAULT_LON
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return DEFAULT_LAT, DEFAULT_LON
    return lat, lon


@app.get("/")
def index() -> Response:
    response = send_from_directory(WEB_DIR, "index.html")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/sw.js")
def service_worker() -> Response:
    response = send_from_directory(WEB_DIR, "sw.js", mimetype="application/javascript")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Service-Worker-Allowed"] = "/"
    return response


@app.get("/manifest.json")
def manifest() -> Response:
    response = send_from_directory(WEB_DIR, "manifest.json", mimetype="application/manifest+json")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/music/<path:filename>")
def music(filename: str) -> Response:
    mimetype = AUDIO_MIME_TYPES.get(Path(filename).suffix.casefold())
    return send_from_directory(MUSIC_DIR, filename, mimetype=mimetype, conditional=True)


@app.get("/api/health")
def api_health() -> Response:
    config = _llm_config()
    files = _music_candidates()
    return _json_response(
        {
            "status": "ok",
            "service": "ZenJarvis",
            "llm_configured": bool(config["api_key"]),
            "llm_model": config["model"] if config["api_key"] else None,
            "weather_provider": (
                "openweathermap" if os.getenv("OPENWEATHER_API_KEY", "").strip() else "open-meteo"
            ),
            "default_city": DEFAULT_CITY,
            "music_count": len(files),
            "music_files": [
                path.relative_to(MUSIC_DIR).as_posix() for path in files
            ],
        }
    )


@app.get("/api/tracks")
def api_tracks() -> Response:
    """Возвращает имена всех доступных аудиофайлов из music/."""
    files = _music_candidates()
    return _json_response([path.name for path in files])


@app.get("/api/music")
def api_music() -> Response:
    """Возвращает выбранный или случайный аудиофайл из music/."""
    files = _music_candidates()
    if not files:
        return _json_response(
            {"error": "Нет музыки", "available": False, "count": 0},
            404,
        )

    requested = request.args.get("track", "").strip()
    if requested:
        chosen = _requested_track(requested, files)
        if chosen is None:
            return _json_response(
                {
                    "error": "Трек не найден",
                    "available": False,
                    "track": requested,
                    "count": len(files),
                },
                404,
            )
    else:
        chosen = random.choice(files)

    payload = _music_payload(chosen)
    payload["count"] = len(files)
    return _json_response(payload)


def _meditation_response(
    mode: str,
    payload: dict[str, Any] | None = None,
    default_duration: int = 300,
) -> Response:
    if payload is None:
        payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        payload = {}

    duration = _bounded_int(payload.get("duration"), 60, 3600, default_duration)
    elapsed = _bounded_int(payload.get("elapsed"), 0, duration, 0)
    text, source = _meditation_payload(elapsed, duration, mode)

    return _json_response(
        {
            "text": text,
            "source": source,
            "mode": mode,
            "elapsed": elapsed,
            "duration": duration,
            "remaining": max(0, duration - elapsed),
        }
    )


@app.get("/api/meditation")
def api_meditation_method_hint() -> Response:
    # Статический catch-all Flask иначе перехватывает GET и отдаёт 404.
    return _json_response({"error": "Используйте POST для получения инструкции"}, 405)


@app.post("/api/meditation")
def api_meditation() -> Response:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        payload = {}
    mode = "nsdr" if str(payload.get("mode", "")).lower() == "nsdr" else "meditation"
    return _meditation_response(mode, payload)


@app.get("/api/nsdr")
def api_nsdr_method_hint() -> Response:
    return _json_response({"error": "Используйте POST для NSDR-инструкции"}, 405)


@app.post("/api/nsdr")
def api_nsdr() -> Response:
    return _meditation_response("nsdr", default_duration=900)


@app.get("/api/weather")
def api_weather() -> Response:
    """Погода отображается отдельно и больше не влияет на выбор музыки."""
    lat, lon = _coords_from_query()
    weather = _get_weather(lat, lon)
    return _json_response(
        {
            "weather": weather,
            "coordinates": {"lat": round(lat, 4), "lon": round(lon, 4)},
        }
    )


def _plain_not_found() -> Response:
    return Response(
        "<!doctype html><html lang='ru'><meta charset='utf-8'>"
        "<title>404 — ZenJarvis</title>"
        "<body style='font-family:system-ui;background:#081311;color:#eef3e7;"
        "display:grid;min-height:100vh;place-items:center;margin:0'>"
        "<p>Страница не найдена. <a style='color:#b9d2b1' href='/'>Вернуться на главную</a></p>"
        "</body></html>",
        status=404,
        content_type="text/html; charset=utf-8",
    )


@app.errorhandler(404)
def not_found(error: Any) -> Response | tuple[Response, int]:
    if request.path.startswith("/api/"):
        return _json_response({"error": "Маршрут не найден", "path": request.path}, 404)
    return _plain_not_found()


@app.errorhandler(405)
def method_not_allowed(error: Any) -> Response | tuple[Response, int]:
    if request.path.startswith("/api/"):
        return _json_response({"error": "Метод не поддерживается", "path": request.path}, 405)
    return Response("Метод не поддерживается", status=405, content_type="text/plain; charset=utf-8")


@app.errorhandler(500)
def internal_error(error: Any) -> Response | tuple[Response, int]:
    LOGGER.exception("Unhandled server error")
    if request.path.startswith("/api/"):
        return _json_response({"error": "Внутренняя ошибка сервера"}, 500)
    return Response(
        "Внутренняя ошибка сервера",
        status=500,
        content_type="text/plain; charset=utf-8",
    )


@app.after_request
def add_security_headers(response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(self), microphone=()")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "img-src 'self' data:; "
        "media-src 'self' blob:; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self'; "
        "worker-src 'self'; "
        "manifest-src 'self'; "
        "base-uri 'none'; "
        "form-action 'none'; "
        "frame-ancestors 'none'",
    )
    return response


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = _bounded_int(os.getenv("PORT"), 1, 65535, 5000)

    debug = _env_bool("FLASK_DEBUG", False)

    LOGGER.info("ZenJarvis доступен по адресу http://127.0.0.1:%s", port)
    LOGGER.info(
        "LLM: %s | Погода: %s",
        "подключена" if _llm_config()["api_key"] else "локальные инструкции",
        "OpenWeatherMap" if os.getenv("OPENWEATHER_API_KEY", "").strip() else "Open-Meteo",
    )
    music_files = _music_candidates()
    LOGGER.info("Найдено аудиофайлов в music/: %s", len(music_files))
    if not music_files:
        LOGGER.info("Папка music/ пуста — положите туда mp3, m4a, aac, ogg, wav или flac.")
    else:
        LOGGER.info(
            "Доступные файлы: %s",
            ", ".join(path.name for path in music_files),
        )
    app.run(host=host, port=port, debug=debug, threaded=True)
