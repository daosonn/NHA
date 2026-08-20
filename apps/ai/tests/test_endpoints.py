"""Test AI service ở mock mode — 0 token, chạy trong CI/máy dev không cần key.

Chạy:  .venv\\Scripts\\python -m pytest apps/ai/tests -q   (từ repo root: cd apps/ai trước)
"""

import os

os.environ["AI_MOCK"] = "1"  # trước khi import app — settings đọc env lúc khởi tạo

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

c = TestClient(app)

MEMBER = {
    "member_id": "mem_1",
    "display_name": "Grandma",
    "role_label": "grandmother",
    "interests": ["gardening"],
    "avoid": ["sweets — doctor's orders"],
    "past_gifts": ["a shawl"],
    "evidence": [
        {"id": "memo_1", "kind": "memo", "text": "Her back hurts when she crouches", "author_name": "Lan"},
        {"id": "post_2", "kind": "post", "text": "In the garden every morning", "author_name": "Minh"},
    ],
}


def test_health():
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert r.json()["mock"] is True


def test_gift_ideas_mock_grounded():
    r = c.post("/v1/gift-ideas", json={"member": MEMBER, "occasion_label": "Birthday", "budget_label": "3.000〜8.000円"})
    assert r.status_code == 200
    body = r.json()
    assert body["mock"] is True
    assert len(body["ideas"]) >= 1
    # provenance: mọi source phải trỏ về evidence THẬT trong request
    valid = {e["id"] for e in MEMBER["evidence"]}
    for idea in body["ideas"]:
        for s in idea["sources"]:
            assert s["evidence_id"] in valid
    # kiêng kỵ cứng phải nổi lên note_to_giver
    assert "sweets" in (body["note_to_giver"] or "").lower()
    # provenance count hiện TRƯỚC ý tưởng
    assert body["evidence_read"]["notes"] == 1
    assert body["evidence_read"]["past_gifts"] == 1


def test_message_three_variants():
    r = c.post("/v1/message-suggestions", json={"member": MEMBER, "occasion_label": "Birthday", "tone": "warm"})
    assert r.status_code == 200
    lengths = [v["length"] for v in r.json()["variants"]]
    assert lengths == ["short", "standard", "heartfelt"]


def test_storyboard_scene_budget():
    media = [{"media_id": f"med_{i}", "kind": "image", "caption": f"photo {i}"} for i in range(8)]
    r = c.post(
        "/v1/video-storyboard",
        json={"member": MEMBER, "media": media, "target_sec": 90, "mood": "nostalgic", "locale": "ja"},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["scenes"]) == 8
    assert all(2.5 <= s["duration_s"] <= 8 for s in body["scenes"])
    assert set(body["palette"].keys()) == {"primary", "secondary", "accent", "text_on_dark"}
    assert body["title"]


def test_analyze_post_signals_about_author():
    r = c.post(
        "/v1/analyze-post",
        json={
            "post_id": "post_1",
            "caption": "Con trai về quê thăm mẹ",
            "author_name": "Grandma",
            "author_role": "grandmother",
            "author_relations": ["parent of Minh"],
            "tagged": [{"label": "A", "display_name": "Minh", "relation_to_author": "her son"}],
            "images_b64": ["ZmFrZQ=="],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["description"]
    # context_analysis là scaffold bắt buộc: phân giải ngôi/vai TRƯỚC khi suy signal
    assert body["context_analysis"]["author_role_in_event"]
    assert 0 < len(body["signals"]) <= 4
    for s in body["signals"]:
        assert s["signal_type"] in {"like", "dislike", "wish", "habit", "health", "milestone"}
        assert 0 <= s["confidence"] <= 1


def test_profile_rollup_merges_and_keeps_gift_history():
    current = {
        "summary": "old",
        "interests": [],
        "avoid": [],
        "wishes": [],
        "gift_ideas_pending": [],
        "gift_history": [{"date": "2026-03-08", "gift": "a shawl", "reaction": "loved it"}],
        "conversation_topics": [],
        "style_hints": {"description": ""},
    }
    signals = [
        {
            "id": "sig_a",
            "source_type": "photo",
            "source_id": "post_1",
            "signal_type": "like",
            "topic": "gardening in the morning",
            "detail": "waters the orchids",
            "confidence": 0.5,
            "observed_at": "2026-05-01",
        },
        {
            "id": "sig_b",
            "source_type": "caption",
            "source_id": "post_2",
            "signal_type": "health",
            "topic": "back pain when crouching",
            "detail": "since April",
            "confidence": 0.7,
            "observed_at": "2026-06-01",
        },
    ]
    r = c.post(
        "/v1/profile-rollup",
        json={
            "display_name": "Grandma",
            "today": "2026-08-19",
            "current_version": 3,
            "current_profile": current,
            "signals": signals,
        },
    )
    assert r.status_code == 200
    profile = r.json()["profile"]
    # health → avoid (hard), like → interests, gift_history GIỮ NGUYÊN
    assert any("back" in a["item"].lower() for a in profile["avoid"])
    assert all(a["hard"] for a in profile["avoid"])
    assert any("garden" in i["topic"].lower() for i in profile["interests"])
    assert profile["gift_history"] == current["gift_history"]
    assert len(profile["interests"]) <= 12


def test_internal_token_enforced(monkeypatch):
    from app import config

    config.settings.cache_clear()
    monkeypatch.setenv("INTERNAL_TOKEN", "secret1")
    try:
        r = c.post("/v1/gift-ideas", json={"member": MEMBER, "occasion_label": "Birthday"})
        assert r.status_code == 401
        r = c.post(
            "/v1/gift-ideas",
            headers={"x-internal-token": "secret1"},
            json={"member": MEMBER, "occasion_label": "Birthday"},
        )
        assert r.status_code == 200
    finally:
        config.settings.cache_clear()
