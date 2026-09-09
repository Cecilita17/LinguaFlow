# 🌍 LinguaFlow - Chatbot de Práctica de Idiomas

Un chatbot conversacional interactivo diseñado para el aprendizaje y práctica de idiomas en tiempo real.

--- 

## 🌟 Características Principales

1. **Corrección Automática en Pantalla con Resaltado en Verde**:
   - Al enviar un mensaje (ejemplo: *"yo tener sueño"*), el mensaje aparece en pantalla corregido automáticamente como *"yo **tengo** sueño"*, con la palabra modificada resaltada en **verde**.
   - Al pasar el cursor o hacer clic sobre la palabra verde, puedes ver la palabra original que habías enviado.
   - Cuenta con botón para reproducir el audio de la frase corregida.

2. **Respuestas Accesibles y Concisas**:
   - El bot responde con frases no demasiado largas ni difíciles (adaptadas a nivel conversacional A2/B1).

3. **Diccionario Interactivo al Clic**:
   - Cada palabra de la respuesta del bot es interactiva: haciendo clic en cualquier palabra desconocida se abre un cuadro con su significado en tu idioma, categoría gramatical y pronunciación en velocidad normal y lenta (0.7x).

4. **Traducción Completa y Audio TTS**:
   - Botón **"Traducir respuesta"** debajo del mensaje para ver la traducción completa en tu idioma nativo.
   - Botón **"Escuchar"** para reproducir la locución en voz alta con entonación natural.

5. **Transliteración Superior (`<ruby>`)**:
   - Para idiomas como **chino mandarín (Pinyin)**, **árabe (romanización)** y **japonés (Romaji)**, la pronunciación fonética aparece directamente arriba de cada palabra.
   - Incluye un interruptor **"Transliteración" (ON/OFF)** en la barra superior para activarla o desactivarla en cualquier momento.

6. **Modo Manos Libres**:
   - Permite mantener una conversación hablada continua sin necesidad de tocar el botón del micrófono:
     - Hablas $\rightarrow$ Se envía automáticamente $\rightarrow$ El bot te responde y te habla $\rightarrow$ Al terminar de hablar, el micrófono vuelve a escucharte automáticamente.

7. **Entrada de Texto y Mensajes de Voz**:
   - Puedes escribir normalmente por teclado o utilizar el botón de micrófono para dictar con tu voz.

---

## 🚀 Cómo Iniciar la Aplicación

Desde la terminal en el directorio del proyecto:

```bash
cd C:\Users\cecif\.gemini\antigravity\scratch\linguaflow-chatbot
npm run dev
```

Esto iniciará tanto el servidor backend (puerto 3001) como la interfaz de usuario en:
👉 **`http://localhost:5173`**

### Configuración de la API
Para activar las respuestas generativas y la transcripción con Groq (`openai/gpt-oss-120b`):
- Configura `GROQ_API_KEY` en tu archivo `.env` en el backend/servidor.
- La variable `GROQ_MODEL` está predeterminada a `openai/gpt-oss-120b`.
