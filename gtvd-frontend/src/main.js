import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import {
  Button,
  NavBar,
  Card,
  Icon,
  Loading,
  Empty,
  PullRefresh,
  List
} from 'vant';
import 'vant/lib/index.css';
import App from './App.vue';
import Daily from './views/Daily.vue';
import './styles/main.scss';

const routes = [
  {
    path: '/',
    redirect: '/daily'
  },
  {
    path: '/daily',
    name: 'Daily',
    component: Daily
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

const app = createApp(App);

app.use(router);
app.use(Button);
app.use(NavBar);
app.use(Card);
app.use(Icon);
app.use(Loading);
app.use(Empty);
app.use(PullRefresh);
app.use(List);

app.mount('#app');
