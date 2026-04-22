// packages/extension/src/popup/main.ts

import { mount } from 'svelte'
import Popup from './Popup.svelte'

const target = document.getElementById('app')!
mount(Popup, { target })
