# Referencia: scoring climático para un copiloto agro de compras

## Resumen
Este documento describe una forma defendible de incorporar pronóstico climático abierto en un copiloto inteligente de compras para agro, sin prometer predicción exacta de precios.[cite:105][cite:120] La idea central es usar clima como señal de riesgo para estimar presión esperada sobre disponibilidad y precios, y combinarla con urgencia operativa, calidad del proveedor y condiciones comerciales para generar recomendaciones explicables dentro de Oracle APEX.[cite:98][cite:123][cite:88][cite:89]

## Contexto del hackathon
El desafío del hackathon está centrado en un copiloto inteligente de compras que registre solicitudes, cargue cotizaciones, compare alternativas, recomiende una opción justificada y genere mensajes de negociación asistidos por IA.[cite:89] La rúbrica prioriza el flujo funcional principal, la integración útil de agentes de IA, la calidad de la recomendación, la claridad visual y la usabilidad de la aplicación en Oracle APEX.[cite:88]

Esto implica que el componente predictivo debe mejorar el proceso de compra, no desviar el proyecto hacia un sistema general de forecasting agrícola.[cite:88][cite:89] En ese marco, el clima es útil como factor de riesgo para compras de insumos agropecuarios porque afecta rendimiento, oferta esperada y volatilidad del mercado, y por tanto puede cambiar la urgencia de compra o negociación.[cite:120][cite:123]

## Qué se puede estimar con clima
Con APIs meteorológicas abiertas sí se puede construir una **estimación de riesgo de precio** o una **presión esperada sobre precios y disponibilidad**, pero no una predicción exacta de precio usando solo clima.[cite:120][cite:123] La literatura económica y de commodities muestra que los shocks climáticos afectan producción, expectativas de traders y oferta agrícola, y eso se traduce en movimientos de precios, aunque mediados por otros factores como demanda global, logística, inventarios y mercados internacionales.[cite:98][cite:120][cite:123]

Por eso, para un hackathon, el output más defendible no es “el precio de la soja será X”, sino algo como:
- Riesgo de suba de precio: bajo / medio / alto.[cite:120]
- Presión esperada: alcista / neutral / bajista.[cite:98]
- Recomendación de compra: comprar ahora / negociar hoy / esperar una mejor oferta.[cite:88][cite:89]

## APIs climáticas sugeridas
### Open-Meteo
Open-Meteo ofrece una API meteorológica abierta, sin API key para el acceso básico, y un plan gratuito/no comercial suficiente para prototipos y hackathons.[cite:105][cite:106] También expone datos de modelos como ECMWF de forma simple, lo que reduce fricción de integración y acelera el MVP.[cite:92][cite:105]

### ECMWF open data
ECMWF publica datos abiertos de pronóstico y clima bajo régimen open data con atribución, y constituye una base sólida para usar señales meteorológicas serias en un prototipo.[cite:102][cite:126] Para el hackathon, lo más práctico no es consumir los archivos brutos de ECMWF, sino apoyarse en Open-Meteo como capa de acceso simplificada.[cite:92][cite:105]

## Horizonte temporal recomendado
| Horizonte | Uso sugerido | Nivel de confianza para el MVP |
|---|---|---|
| 1 a 3 días | Operación inmediata | Alto [cite:92] |
| 7 a 10 días | Señal principal de riesgo climático | Alto a medio [cite:92][cite:105] |
| 14 a 15 días | Señal secundaria / aviso temprano | Medio [cite:92] |
| 46 días | Semáforo de riesgo sub-estacional | Bajo para decisiones finas [cite:126] |
| Estacional | Contexto de campaña | Bajo para procurement diario [cite:126] |

Para este caso de uso, la mejor recomendación es usar **7 a 10 días** como núcleo del score, porque conserva valor operacional y sigue siendo defendible ante preguntas técnicas.[cite:92] Un horizonte de 14 a 15 días puede agregarse como señal de segundo nivel, mientras que escalas sub-estacionales o estacionales sirven mejor como contexto general que como disparador de compra.[cite:126]

## Diseño del modelo de scoring
La propuesta consiste en combinar cuatro dimensiones en un score final de procurement:

\[
\text{Procurement Score} = w_1(\text{weather risk}) + w_2(\text{delivery urgency}) + w_3(\text{supplier score}) + w_4(\text{commercial terms})
\]

Este enfoque está alineado con la rúbrica del hackathon porque ayuda a producir una recomendación clara y justificada a partir de múltiples criterios relevantes.[cite:88] También permite que el agente de IA explique el razonamiento en lenguaje natural, en vez de limitarse a elegir el proveedor más barato.[cite:89]

## Variables del score
### Weather risk
Weather risk mide la probabilidad de que condiciones climáticas adversas afecten rendimiento, oferta o presión de mercado en el corto plazo.[cite:98][cite:120] Puede construirse con:
- anomalía esperada de precipitación;
- presencia de calor extremo o heat stress;
- exceso de lluvia relevante para labores o logística;
- señal de riesgo estacional como complemento.[cite:92][cite:126]

Ejemplo orientativo:
| Condición | Score |
|---|---:|
| Sequía fuerte esperada | 90 |
| Sequía moderada | 70 |
| Neutral | 40 |
| Muy favorable | 20 |

### Delivery urgency
Delivery urgency mide cuánto necesita el comprador cerrar la compra ahora en función del stock y del tiempo de reposición.[cite:89] Puede usar:
- stock actual;
- días de cobertura;
- lead time del proveedor;
- criticidad del insumo.

Ejemplo:
| Situación | Score |
|---|---:|
| Stock menor a 7 días | 95 |
| Stock entre 7 y 15 días | 70 |
| Stock mayor a 15 días | 35 |

### Supplier score
Supplier score resume el desempeño histórico del proveedor. Aunque sea con datos demo, conviene modelarlo como:
- cumplimiento de entregas;
- incidencias o reclamos;
- consistencia documental;
- reputación interna del comprador.

Ejemplo:
| Perfil de proveedor | Score |
|---|---:|
| Muy confiable | 90 |
| Aceptable | 65 |
| Riesgoso | 35 |

### Commercial terms
Commercial terms representa el atractivo comercial de la cotización.[cite:88] Debe incluir variables mencionadas explícitamente en la evaluación:
- precio;
- plazo de entrega;
- garantía;
- disponibilidad;
- forma de pago;
- otras condiciones comerciales.[cite:88]

Ejemplo:
| Calidad de oferta | Score |
|---|---:|
| Mejor combinación total | 90 |
| Buena pero no óptima | 65 |
| Oferta débil | 35 |

## Versión recomendada para el hackathon
En vez de un solo score, conviene implementar dos:

### Urgency Score
\[
\text{Urgency Score} = 0.45(\text{weather risk}) + 0.40(\text{delivery urgency}) + 0.15(\text{market volatility proxy})
\]

Este score responde a la pregunta: **¿hay que comprar ahora o se puede esperar?**.[cite:120][cite:123]

### Offer Score
\[
\text{Offer Score} = 0.35(\text{supplier score}) + 0.40(\text{commercial terms}) + 0.25(100 - \text{delivery risk})
\]

Este score responde a la pregunta: **¿qué proveedor conviene más?**.[cite:88][cite:89]

## Reglas de decisión
| Condición | Resultado |
|---|---|
| Urgency Score alto + Offer Score alto | Comprar ahora |
| Urgency Score alto + Offer Score medio | Negociar hoy y cerrar pronto |
| Urgency Score medio + Offer Score alto | Comprar con seguimiento |
| Urgency Score bajo + Offer Score bajo | Esperar mejores cotizaciones |
| Offer Score muy bajo | No recomendado |

Para una implementación mínima, también se puede usar un solo score final con rangos:
- 80–100: comprar ahora;
- 60–79: negociar y cerrar pronto;
- 40–59: esperar mejor oferta;
- 0–39: no recomendado.[cite:88]

## Cómo explicarlo con IA
El agente de IA debe transformar el score en una recomendación comprensible y alineada con la decisión humana asistida, que es exactamente lo que valora la guía de evaluación.[cite:88] Ejemplo de salida:

> Se recomienda avanzar con el Proveedor B porque el riesgo climático de sequía para los próximos 10 días es alto, el stock actual cubre solo 6 días y esta oferta combina entrega más rápida con pago a 30 días. Aunque el precio no es el menor, ofrece mejor equilibrio entre disponibilidad, urgencia y riesgo de mercado.[cite:92][cite:120][cite:123]

Otro ejemplo:

> Se recomienda negociar antes de cerrar. La oferta actual es comercialmente aceptable, pero el clima no muestra una señal crítica en los próximos 7 días y existe margen para buscar una mejora de precio o plazo sin comprometer abastecimiento.[cite:92][cite:88]

## Integración en Oracle APEX
La aplicación puede estructurarse así:

### Pantallas
- Solicitudes de compra.
- Proveedores.
- Cotizaciones.
- Comparador de ofertas.
- Panel de riesgo climático.
- Recomendación final.
- Generador de mensaje de negociación.[cite:89]

### Datos mínimos
| Entidad | Campos sugeridos |
|---|---|
| Purchase Request | producto, cantidad, ubicación, urgencia, stock actual |
| Supplier | nombre, lead time, score histórico, condiciones |
| Quote | precio, pago, entrega, disponibilidad, garantía |
| Weather Snapshot | ubicación, fecha, precipitación, temperatura, risk score |
| Recommendation | urgency score, offer score, recomendación, explicación |

### Flujo
1. El usuario registra una solicitud de compra en APEX.[cite:89]
2. Se cargan proveedores y cotizaciones.[cite:89]
3. El backend consulta Open-Meteo para la zona agrícola relevante.[cite:105]
4. Se calcula weather risk y luego el score de procurement.
5. El agente genera recomendación explicada.
6. El usuario puede generar un mensaje de negociación personalizado.[cite:89]

## Qué decir en el pitch
La formulación más sólida es:

> La solución no pretende adivinar el precio exacto del mercado. Integra pronóstico climático abierto para estimar riesgo de presión sobre disponibilidad y precios, y usa ese contexto junto con stock, urgencia, desempeño del proveedor y términos comerciales para recomendar la mejor decisión de compra.[cite:102][cite:105][cite:120]

Este framing evita sobrepromesas, mantiene la factibilidad técnica y conecta directamente con los criterios de funcionalidad, IA útil, recomendación justificable e impacto operativo.[cite:88]

## Recomendación final
Para el hackathon, la mejor versión de este enfoque es construir un **copiloto agro de compras** donde el clima se use como multiplicador de urgencia y riesgo, no como motor aislado de predicción de precios.[cite:88][cite:89] El objetivo debe ser demostrar una recomendación más inteligente y mejor justificada que un comparador de cotizaciones tradicional, apoyándose en APIs abiertas y gratuitas para el prototipo como Open-Meteo y ECMWF open data.[cite:105][cite:106][cite:102]
