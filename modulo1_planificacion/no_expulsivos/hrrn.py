from modulo1_planificacion.proceso import Proceso

def simular(procesos: list[Proceso], **kwargs):
    procs = list(procesos)
    gantt, log = [], []
    tiempo = 0
    terminados = []

    while procs:
        disponibles = [p for p in procs if p.llegada <= tiempo]
        if not disponibles:
            tiempo = min(p.llegada for p in procs)
            log.append(f"t={tiempo}: CPU ociosa. Avanza a t={tiempo}.")
            continue
        def hrrn(p):
            espera = tiempo - p.llegada
            return (espera + p.rafaga) / p.rafaga
        p = max(disponibles, key=hrrn)
        ratio = round(hrrn(p), 2)
        procs.remove(p)
        log.append(f"t={tiempo}: selecciona {p.pid} ({p.nombre}) — ratio HRRN={ratio}.")
        p.t_inicio = tiempo
        for t in range(p.rafaga):
            gantt.append({"pid": p.pid, "t": tiempo + t})
        tiempo += p.rafaga
        p.t_fin = tiempo
        p.calcular_metricas()
        log.append(f"t={tiempo}: termina {p.pid}. TR={p.tr}, TE={p.te}.")
        terminados.append(p)

    return _resultado(gantt, terminados, log)

def _resultado(gantt, procs, log):
    tabla = [p.to_dict() for p in procs]
    te = sum(p.te for p in procs) / len(procs)
    tr = sum(p.tr for p in procs) / len(procs)
    return {"gantt": gantt, "tabla": tabla, "log": log,
            "te_promedio": round(te, 2), "tr_promedio": round(tr, 2)}