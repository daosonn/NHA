# Product Overview

## 1. Product Purpose

This product is a mobile-first family memory and relationship application.

Its purpose is to help family members preserve personal life stories, memories, relationships, and important moments in one shared family-oriented space.

The product is designed for families whose members may:

- live far apart;
- have limited time to communicate;
- belong to different generations;
- store photos and memories across many different devices or services;
- gradually lose important family stories over time.

The application should help family members stay emotionally connected while preserving information that may remain valuable across generations.

---

## 2. Core Problem

Modern families may experience several problems:

- Family members living far apart interact less frequently.
- Important events may be missed.
- Photos, videos, audio, and stories are scattered across devices and platforms.
- Older family members may have difficulty following the lives of younger generations.
- Younger generations may know little about the lives of parents and grandparents.
- Personal stories and family memories may disappear over time.
- Busy family members may forget birthdays, anniversaries, or other important dates.
- People may find it difficult to express care or choose meaningful gifts.

The product should provide a private and structured environment to reduce these problems.

---

## 3. Target Users

The primary users are family members across different generations.

Typical user groups include:

### Family Members Living Away From Home

Examples:

- students;
- young professionals;
- people living in another city or country.

Their main need is to remain connected with family members and keep up with everyday family life.

### Parents and Grandparents

They may want to:

- follow the lives of children and grandchildren;
- easily view family photos and videos;
- preserve their own stories and memories.

The interface should remain understandable for older users.

### Busy Family Members

They may need help remembering:

- birthdays;
- anniversaries;
- family events;
- important personal milestones.

### Multi-Generation Families

They may want to preserve:

- family history;
- relationships;
- biographies;
- important life events;
- photos;
- videos;
- stories.

---

## 4. Core Product Concept: Life Profile

The central product concept is the **Life Profile**.

A Life Profile represents a person's life inside the family.

It may contain:

- personal information;
- biography;
- family relationships;
- important life events;
- timeline;
- photos;
- videos;
- audio;
- stories;
- memories;
- albums;
- interests;
- preferences;
- wishes.

The Life Profile should act as the main destination for exploring information about a family member.

Other product features should generally support the creation, organization, discovery, or preservation of Life Profile content.

---

## 5. Family Tree

The Family Tree represents members and their relationships across generations.

Its purpose is not only to display genealogy.

It also acts as a navigation system.

Example:

```text
Family Tree
    ↓
Select Member
    ↓
Life Profile
    ↓
Biography / Timeline / Memories
```

Relationships should be treated as structured domain data rather than only visual connections on a screen.

Typical relationships may include:

parent;
child;
spouse;
sibling.

The complete relationship model will be defined separately.

## 6. Life Timeline

Each member may have a Life Timeline containing important events and milestones.

Examples include:

birth;
education;
graduation;
employment;
marriage;
children;
achievements;
relocation;
travel;
family events;
meaningful personal experiences.

A Life Timeline allows users to understand a person's life chronologically.

## 7. Memories

Users should be able to preserve everyday and historical memories.

Memory content may include:

photos;
videos;
audio recordings;
written stories;
messages;
letters;
documents;
locations.

A memory may be related to:

one member;
multiple members;
a Life Event;
an album;
a family event.

The same memory may be displayed in multiple contexts without unnecessarily duplicating the underlying content.

## 8. Family Space

Each family should have a shared family-oriented space.

This space may contain:

recent family updates;
shared memories;
photos and videos;
upcoming important dates;
historical memories;
family albums;
notifications.

The Family Home should help users quickly understand what is happening within their family.

## 9. Personal Archive

Users may also have a private personal archive.

It may contain:

photos;
videos;
audio;
notes;
journals;
documents;
letters;
memories not yet shared.

Users should eventually be able to decide whether content remains private or is shared with selected family members.

The detailed privacy and permission model will be defined separately.

## 10. AI-Assisted Features

AI is a supporting capability of the product.

Potential AI features include:

speech-to-text;
summarization;
organizing personal stories;
analyzing interests and preferences;
suggesting greetings;
suggesting gifts;
suggesting family activities;
generating commemorative albums;
generating commemorative videos;
assisting with memory organization.

AI-generated information should not automatically replace user-provided personal information.

Where appropriate, users should be able to review or confirm AI-generated results.

The core product should remain usable even if AI services are temporarily unavailable.

## 11. Important Dates and Reminders

The product may help family members remember important dates such as:

birthdays;
wedding anniversaries;
memorial dates;
family anniversaries;
personal milestones.

Future AI-assisted features may suggest:

messages;
gifts;
activities;
places;
ways to show care.
## 12. On This Day

The product may resurface memories from the same date in previous years.

Examples:

photos;
videos;
family events;
personal milestones;
stories.

This feature is intended to encourage family members to revisit and interact with older memories.

## 13. Memory Map

Memories may optionally be associated with locations.

Examples:

hometown;
old family house;
school;
workplace;
travel destination;
wedding venue.

A Memory Map may allow users to explore memories through places connected to their lives.

## 14. Product Experience Principles

The application should follow these principles:

Mobile First

The primary experience is designed for smartphone-sized screens.

Target viewport:

approximately 375px – 430px
Simple

The interface should remain understandable across generations.

Personal

The experience should focus on people, relationships, and meaningful memories rather than generic social-media engagement.

Private

Family information and personal memories may be sensitive.

Privacy and permission design must be considered from the beginning.

Long-Term

The product should treat memories and life information as content that may remain valuable for many years.

AI-Assisted, Not AI-Dependent

AI should help users organize and create content, but core product functionality must not depend entirely on AI.

## 15. Core User Journey

The current expected core flow is:

Register / Login
        ↓
Create / Join Family
        ↓
Family Home
        ↓
Family Tree
        ↓
Select Member
        ↓
Life Profile
        ↓
Life Timeline
        ↓
Life Event / Memory

This flow represents the core product experience.

Supporting features should integrate naturally into this journey rather than create isolated product areas.

## 16. Current Major Capabilities

Current product direction includes:

Core
authentication;
family creation/joining;
family members;
Life Profile;
Life Timeline;
memories;
Family Tree.
Supporting
albums;
shared family memory space;
personal archive;
important-date reminders;
On This Day;
notifications;
Memory Map.
AI-Assisted
interest/preference analysis;
greeting suggestions;
gift suggestions;
story assistance;
automatic albums;
automatic commemorative videos.

Not all capabilities are necessarily part of the first MVP.

The implementation priority will be defined in:

docs/00-shared/mvp-scope.md
## 17. Product Boundaries

The product is not intended to be:

a general social network;
a public photo-sharing platform;
a genealogy research database;
an AI-only application.

The product focuses specifically on:

family relationships + personal life stories + long-term memories.

## 18. Open Product Decisions

The following areas are not yet finalized:

exact MVP scope;
final product name;
detailed User ↔ Member relationship;
permission roles;
privacy rules;
exact family relationship model;
media storage strategy;
notification delivery method;
AI providers and models;
final UI design system;
localization strategy.

These decisions should be defined in dedicated documentation when required.

Do not invent them during implementation.