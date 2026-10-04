import { mount } from "svelte";
import App from "./App.svelte";
import { applyTheme } from "./config/theme.js";
import "./app.css";

applyTheme();
mount(App, { target: document.getElementById("app") });
