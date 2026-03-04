-_____________________________________________________________________________________________________________________________________-

Conversational3DAvatar

3D conversational avatar built with React, Vite and Three.js, integrated with an LLM API.

This project explores real-time conversational interaction with a VRM-based 3D character rendered in the browser.

-______________________________________________________________________________________________________________________________________-

Overview

Conversational3DAvatar renders a VRM avatar using Three.js and connects it to a large language model API for text-based interaction.

The current focus of the project is:

3D avatar rendering (VRM format)

Text-based conversational interface

LLM integration via API

Modular project architecture for future expansion


Voice interaction, streaming integration, and advanced contextual memory are not yet implemented.

-______________________________________________________________________________________________________-

Tech Stack

React

Vite

Three.js

@pixiv/three-vrm

Groq API (LLaMA 3.x)

-__________________________________________________________________________________________________________-

Project Structure

node_modules/
public/
server/
src/
.env
.gitignore
vite.config.js
package.json

-____________________________________________________________-

Running Locally

npm install
npm run dev

-_______________________________________________________________-

Environment Variables

Create a .env file in the project root:

VITE_GROQ_API_KEY=your_api_key_here

The .env file must not be committed to version control.

-______________________________________________________________________-

VRM Model Setup

1. Install dependencies:

npm install three @pixiv/three-vrm

2. Place a .vrm file inside the /public directory.


3. Configure the model path inside App.jsx:


const VRM_URL = "/avatar.vrm";

-______________________________________________________________________________-

Current Capabilities

Loads and renders a VRM 3D model

Basic animation loop

Text-based conversation via LLM API

Persona configuration through system prompt


-__________________________________________________________________________-

Not Implemented Yet

Speech-to-text

Text-to-speech

Persistent memory storage

YouTube/Twitch chat integration

Desktop overlay mode


These are planned as future extensions.


-___________________________________________________________________________________________________________________________________________________-

Project Goal

The long-term objective is to evolve this into a modular conversational 3D assistant with real-time interaction capabilities, potentially suitable for streaming or productivity companion scenarios.

-________________________________________________________________________________________________________________________________________________________-
