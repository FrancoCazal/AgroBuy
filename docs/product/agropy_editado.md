# AgroPy Editado

## Resumen
AgroPy Editado transforma una idea de forecasting agrícola en una plataforma de **control operativo de campaña** para cooperativas y acopiadores, con foco en decisiones accionables más que en predicción aislada.[cite:4] El objetivo es mejorar su fit con el hackathon: más automatización empresarial, más protagonismo de Oracle APEX y una narrativa menos parecida a un tablero analítico tradicional.[cite:49]

## Problema
Productores medianos, cooperativas y acopiadores suelen planificar zafra, compras de insumos, visitas técnicas y capacidad logística con una mezcla de experiencia, hojas de cálculo y señales tardías del clima.[cite:41] Un dashboard de rendimiento futuro es útil, pero por sí solo se siente más advisory que operacional, y eso lo vuelve menos competitivo frente a criterios que favorecen utilidad inmediata y despliegue empresarial rápido.[cite:49][cite:53]

## Propuesta
La propuesta se redefine como **Agro Campaign Control Tower**: un centro operativo que usa señales de rendimiento esperado, anomalías climáticas y costos de campaña para priorizar acciones de cooperativa, visitas técnicas, compras de insumos y alertas por zona.[cite:4][cite:41] El forecast sigue existiendo, pero pasa a ser insumo para decisiones, no el producto completo.

## Usuarios
- Gerente de cooperativa: prioriza compras, seguros y capacidad.
- Técnico de campo: identifica qué zonas visitar primero.
- Acopiador: estima oferta probable y concentra logística.
- Productor mediano: consulta escenarios y riesgo climático.

## Alcance del MVP
- 1 cultivo prioritario, idealmente soja.
- 3 a 5 departamentos demo.
- 1 panel de control con ranking de riesgo.
- 1 simulador what-if climático.
- 1 cola de acciones recomendadas.
- 1 flujo WhatsApp simple para consulta puntual.[cite:49]

## Stack propuesto
| Capa | Tecnología |
|---|---|
| UI operacional | Oracle APEX |
| Backend | Python + FastAPI |
| Base de datos | PostgreSQL |
| Forecast y scoring | XGBoost / baseline histórico |
| Orquestación LLM | LangGraph |
| Clima | Open-Meteo |
| Mensajería | Twilio WhatsApp |

El evento menciona inteligencia predictiva aplicada a agricultura y paneles inteligentes, por lo que esta versión encaja bien si demuestra decisiones operativas concretas y no solo visualización.[cite:4]

## Arquitectura
1. Se ingieren series históricas de rendimiento y clima.
2. Se calcula un forecast simple por zona.
3. Un motor de escenarios ajusta proyecciones ante cambios de precipitación o temperatura.
4. Un motor de priorización convierte el forecast en acciones operativas.
5. APEX muestra mapa, ranking de riesgo, decisiones sugeridas y métricas de campaña.
6. LangGraph responde consultas y explica el porqué de cada priorización.

## Componente de IA
La IA central queda compuesta por:
- Forecast tabular y explicable por departamento.
- Escenarios what-if climáticos.
- Priorización operativa: qué zona atender, dónde comprar antes, qué capacidad reforzar.
- Agente explicativo para usuarios de negocio.

Este reposicionamiento mejora la utilidad frente a jurados que valoran casos reales, predictivos y accionables más que experimentos bonitos sin workflow.[cite:49][cite:53]

## Oracle APEX
Para mejorar el fit del proyecto, APEX debe administrar:
- Carga de superficies o campaña esperada.
- Cola de alertas pendientes.
- Tareas sugeridas por zona.
- Dashboard con impacto financiero estimado.
- Simulador de escenarios con respuesta inmediata.

Eso hace que APEX sea una herramienta de control operativo, no solo un contenedor de charts.[cite:48][cite:52]

## Demo sugerida
1. El gerente abre el control tower y ve ranking de departamentos por riesgo.
2. Cambia un escenario de precipitación y baja el rendimiento esperado en una zona.
3. El sistema sugiere acción: compra anticipada, visita técnica o ajuste de logística.
4. El panel recalcula margen o impacto agregado.
5. Un productor consulta por WhatsApp y recibe la misma lógica resumida.

## Fortalezas frente al jurado
- Menos saturado que proyectos financieros o de BI clásico.
- Muy conectado con agricultura, una pista mencionada explícitamente por el evento.[cite:4]
- Visualmente fuerte para demo por mapas y simuladores.
- Tiene ML defendible con restricciones de datos reconocidas.

## Debilidades y riesgos
- Sigue dependiendo de datos relativamente agregados y pocos puntos por zona.
- El onboarding real del cliente queda fuera del hackathon.
- Si el forecast no es convincente, hay que sostener el valor con el motor de priorización y escenarios.

## Qué lo haría ganador
El proyecto se vuelve mucho más competitivo si se presenta como un sistema de planificación operativa de campaña con IA explicable, no como una plataforma general de predicción de cosechas.[cite:49]
