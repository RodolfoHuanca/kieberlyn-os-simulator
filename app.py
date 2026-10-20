from flask import Flask, render_template, jsonify, request
from modulo1_planificacion.proceso import from_dict
from modulo1_planificacion.no_expulsivos import fcfs, sjf, prioridad_estatica, hrrn
from modulo1_planificacion.expulsivos import round_robin, srt, prioridad_dinamica, mlfq, cfs, edf

app = Flask(__name__)

ALGORITMOS = {
    "fcfs":              fcfs,
    "sjf":               sjf,
    "prioridad_estatica":prioridad_estatica,
    "hrrn":              hrrn,
    "round_robin":       round_robin,
    "srt":               srt,
    "prioridad_dinamica":prioridad_dinamica,
    "mlfq":              mlfq,
    "cfs":               cfs,
    "edf":               edf,
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/simular', methods=['POST'])
def simular():
    data      = request.json
    algoritmo = data.get('algoritmo', 'fcfs')
    quantum   = int(data.get('quantum', 4))
    procesos  = [from_dict(p) for p in data.get('procesos', [])]
    if not procesos:
        return jsonify({'error': 'Sin procesos'}), 400
    mod = ALGORITMOS.get(algoritmo)
    if not mod:
        return jsonify({'error': f'Algoritmo {algoritmo} no encontrado'}), 400
    resultado = mod.simular(procesos, quantum=quantum)
    return jsonify(resultado)

@app.route('/api/concurrencia', methods=['POST'])
def concurrencia():
    from modulo2_concurrencia import productor_consumidor, lectores_escritores, filosofos, barbero, fumadores
    data      = request.json
    problema  = data.get('problema', 'productor_consumidor')
    n_segundos= int(data.get('n_segundos', 5))
    mods = {
        'productor_consumidor': productor_consumidor,
        'lectores_escritores':  lectores_escritores,
        'filosofos':            filosofos,
        'barbero':              barbero,
        'fumadores':            fumadores,
    }
    mod = mods.get(problema)
    if not mod:
        return jsonify({'error': 'Problema no encontrado'}), 400
    resultado = mod.simular(n_segundos)
    return jsonify(resultado)

@app.route('/api/estado')
def estado():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True)