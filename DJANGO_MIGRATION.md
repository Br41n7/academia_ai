# Academic AI — Django Backend Migration Guide

This document acts as an architectural blueprint for migrating the **Academic AI** backend from the temporary/mock **Firebase + Express** setup to a robust, enterprise-grade **Django + Django REST Framework (DRF)** backend in Python.

---

## 1. High-Level Architecture Transition

```
CURRENT ARCHITECTURE (Testing/Prototyping)
┌──────────────┐      HTTP / JSON      ┌──────────────────┐
│  Vite React  │──────────────────────>│ Express Backend  │
│  (Frontend)  │                       │ (File Extraction)│
└──────────────┘                       └─────────┬────────┘
       │                                         │
       │ Reads/Writes Directly                   │ Writes Clean Text
       ▼                                         ▼
┌─────────────────────────────────────────────────────────┐
│              Firebase (Auth & Firestore)                │
└─────────────────────────────────────────────────────────┘

FUTURE ARCHITECTURE (Django Production)
┌──────────────┐      HTTP / JSON      ┌─────────────────────────────────┐
│  Vite React  │──────────────────────>│         Django Backend          │
│  (Frontend)  │                       │ (DRF Viewsets, Auth, AI, RAG)   │
└──────────────┘                       └────────────────┬────────────────┘
                                                        │
                                                        ▼  Django ORM
                                       ┌─────────────────────────────────┐
                                       │ PostgreSQL Database (pgvector)  │
                                       └─────────────────────────────────┘
```

---

## 2. Django Database Models (ORM)

To replace Firebase Firestore collections, we will define clean Django ORM models inside `models.py`. By migrating to Django, you can also natively use **pgvector** inside PostgreSQL for RAG text embeddings without requiring a separate database setup.

```python
# myapp/models.py
from django.db import models
from django.contrib.auth.models import User
import uuid

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    academic_level = models.CharField(max_length=100, default='undergraduate')
    study_streak = models.IntegerField(default=0)
    points = models.IntegerField(default=0)
    badges = models.JSONField(default=list, blank=True)
    last_active_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username

class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='documents')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    content = models.TextField()
    source_type = models.CharField(max_length=50, default='text') # 'pdf', 'txt', 'url'
    created_at = models.DateTimeField(auto_now_add=True)

class ProjectNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class QuizAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.FloatField()
    total_questions = models.IntegerField()
    difficulty_level = models.CharField(max_length=50)
    attempt_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

class ExamAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    exam_id = models.CharField(max_length=255)
    score = models.IntegerField()
    total_questions = models.IntegerField()
    answers = models.JSONField()
    analysis = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField()
    modules = models.JSONField() # Holds the structured chapters and lessons
    created_at = models.DateTimeField(auto_now_add=True)

class CourseProgress(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    completed_lessons = models.JSONField(default=list)
    quiz_scores = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

class StudyReminder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    topic = models.CharField(max_length=255)
    scheduled_time = models.DateTimeField()
    status = models.CharField(max_length=50, default='pending') # 'pending', 'sent', 'cancelled'
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 3. Python Gemini AI Service Layer

Using Google's official `google-genai` Python library, we will implement the secured server-side AI generation operations.

```python
# myapp/ai_services.py
from google import genai
from google.genai import types
from django.conf import settings
from .models import Document, ProjectNote
import json

client = genai.Client(api_key=settings.GEMINI_API_KEY)

def get_project_context(project_id, user):
    # Fetch project-specific data securely using Django ORM
    docs = Document.objects.filter(project_id=project_id, user=user)
    notes = ProjectNote.objects.filter(project_id=project_id, user=user)

    docs_text = "\n\n".join([d.content for d in docs])
    notes_text = "\n\n".join([n.content for n in notes])

    # Truncate to protect against token overflow
    max_chars = 150000
    if len(docs_text) > max_chars:
        docs_text = docs_text[:max_chars] + "\n\n[CONTEXT TRUNCATED]"
    if len(notes_text) > max_chars:
        notes_text = notes_text[:max_chars] + "\n\n[CONTEXT TRUNCATED]"

    return f"CONTEXT FROM PROJECT DOCUMENTS:\n{docs_text}\n\nCONTEXT FROM PROJECT NOTES:\n{notes_text}"

def generate_notebook_action(action, project_id, user, user_query=None, use_grounding=False):
    context = get_project_context(project_id, user)

    prompts = {
        'summarize': f"Based on the following context, provide a comprehensive summary of key concepts:\n\n{context}",
        'explain': f"Based on the following context, explain complex topics in simple terms:\n\n{context}",
        'exam_questions': f"Based on the following context, generate 5 exam questions with brief answers:\n\n{context}",
        'chat': f"Context:\n{context}\n\nUser Question: {user_query}\n\nAnswer based on context.",
        'mindmap': f"Based on the following context, generate a structured mindmap in Markdown lists:\n\n{context}",
        'knowledge_graph': f"Based on the following context, identify entities and relationships as Markdown:\n\n{context}"
    }

    prompt = prompts.get(action, f"Analyze this context:\n\n{context}")

    config = types.GenerateContentConfig()
    if use_grounding:
        config.tools = [{"google_search": {}}]

    response = client.models.generate_content(
        model='gemini-3-flash-preview',
        contents=prompt,
        config=config
    )

    # Extract search grounding sources if present
    sources = []
    metadata = response.candidates[0].grounding_metadata if response.candidates else None
    if metadata and metadata.grounding_chunks:
        for chunk in metadata.grounding_chunks:
            if chunk.web:
                sources.append({
                    "title": chunk.web.title or "Source",
                    "uri": chunk.web.uri or ""
                })

    return {
        "text": response.text,
        "sources": sources
    }
```

---

## 4. REST APIs and Views (DRF)

Using **Django REST Framework (DRF)**, we can expose endpoints securely.

```python
# myapp/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .ai_services import generate_notebook_action

class NotebookActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action = request.data.get('action')
        project_id = request.data.get('projectId')
        user_query = request.data.get('userQuery')
        use_grounding = request.data.get('useGrounding', False)

        if not project_id:
            return Response({"error": "Project ID is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = generate_notebook_action(
                action=action,
                project_id=project_id,
                user=request.user,
                user_query=user_query,
                use_grounding=use_grounding
            )
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

And configure `urls.py`:
```python
# myapp/urls.py
from django.urls import path
from .views import NotebookActionView

urlpatterns = [
    path('api/ai/notebook-action/', NotebookActionView.as_view(), name='notebook_action'),
]
```

---

## 5. Security & Authentication Migration

Since the React client currently implements Google Auth via Firebase, you can transition authentication to Django in two ways:

1. **Token Integration (Simplest for transition):**
   * Keep Firebase Auth on the frontend.
   * Send the Firebase ID Token in the `Authorization: Bearer <ID_TOKEN>` header with every API request.
   * On Django, write a custom authentication backend that decodes and validates the Firebase token using `firebase-admin` Python SDK:
     ```python
     # myapp/authentication.py
     from rest_framework.authentication import BaseAuthentication
     from django.contrib.auth.models import User
     from rest_framework import exceptions
     from firebase_admin import auth as firebase_auth

     class FirebaseAuthentication(BaseAuthentication):
         def authenticate(self, request):
             auth_header = request.META.get('HTTP_AUTHORIZATION')
             if not auth_header or not auth_header.startswith('Bearer '):
                 return None
             id_token = auth_header.split(' ')[1]
             try:
                 decoded_token = firebase_auth.verify_id_token(id_token)
                 uid = decoded_token['uid']
                 email = decoded_token.get('email', '')
                 # Create or get Django user mapping to Firebase UID
                 user, created = User.objects.get_or_create(username=uid, defaults={'email': email})
                 return (user, None)
             except Exception as e:
                 raise exceptions.AuthenticationFailed('Invalid token')
     ```

2. **Native Django Auth (Full transition):**
   * Use Django packages like `django-allauth` or `dj-rest-auth` for complete authentication control, exposing `/api/auth/login/` and social token verification endpoints natively.
