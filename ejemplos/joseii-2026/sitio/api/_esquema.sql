create table if not exists estado (
  id int primary key default 1 check (id = 1),
  diapositiva int not null default 1,
  paso int not null default 0,
  pasos int not null default 0,
  total int not null default 22,
  titulo text not null default '',
  notas text not null default '',
  encuestas text[] not null default '{}',
  abierta boolean not null default false,
  recibe_preguntas boolean not null default true,
  indice jsonb not null default '[]',
  minuto_plan int not null default 0,
  reloj_inicio timestamptz,
  latido timestamptz,
  ronda int not null default 0,
  actualizado timestamptz not null default now()
);
insert into estado (id) values (1) on conflict (id) do nothing;

create table if not exists votos (
  encuesta text not null,
  dispositivo text not null,
  opcion text not null,
  huella text,
  creado timestamptz not null default now(),
  primary key (encuesta, dispositivo)
);

create table if not exists preguntas (
  id bigserial primary key,
  dispositivo text not null,
  texto text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada', 'respondida')),
  creado timestamptz not null default now()
);
create index if not exists preguntas_estado on preguntas (estado, creado);

create table if not exists apoyos (
  pregunta_id bigint not null references preguntas (id) on delete cascade,
  dispositivo text not null,
  primary key (pregunta_id, dispositivo)
);

create table if not exists comandos (
  seq bigserial primary key,
  tipo text not null,
  valor jsonb,
  creado timestamptz not null default now()
);

create table if not exists intentos_pin (
  huella text not null,
  creado timestamptz not null default now()
);
create index if not exists intentos_pin_creado on intentos_pin (creado);

create table if not exists palabras (
  dispositivo text primary key,
  texto text not null,
  clave text not null,
  huella text,
  oculta boolean not null default false,
  creado timestamptz not null default now()
);

create table if not exists app_demo (
  id int primary key default 1 check (id = 1),
  html text not null,
  version int not null default 1,
  creado timestamptz not null default now()
);
create index if not exists votos_huella on votos (encuesta, huella);
