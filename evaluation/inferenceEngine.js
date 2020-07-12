function InferenceEngine(config, commands) {

  this.inference_window_ms = config['inference_window_ms']
  this.smoothing_window_ms = config['smoothing_window_ms']
  this.tolerance_window_ms = config['tolerance_window_ms']
  this.inference_weights = config['inference_weights']
  this.inference_sequence = config['inference_sequence']
  this.stride_size = config['stride_size']

  this.commands = commands;
  this.num_class = commands.length;

  if (this.num_class != this.inference_weights.length) {
    alert('inference weights and number of commands mismatch');
  }

  // posterior smoothing
  this.pred_history = [];
  this.label_history = [];
}

InferenceEngine.prototype.sequencePresent = function() {

  if (this.inference_sequence.length == 0) return true;

  var d = new Date();
  let curr_time = d.getTime();

  this.label_history = this.dropOldEntries(curr_time, this.label_history, this.inference_window_ms);

  let curr_label = null;
  let target_state = 0;
  let last_valid_timestamp = 0;


  for (var i = 0; i < this.label_history.length; i++) {
    label = this.label_history[i][1];
    curr_timestemp = this.label_history[i][0];
    target_label = this.inference_sequence[target_state];


    if (label == target_label) { // move to next entry
      target_state += 1;
      target_label = this.inference_sequence[target_state];
      curr_label = this.inference_sequence[target_state-1];
      last_valid_timestamp = curr_timestemp;

      if (target_label == this.inference_sequence.length) { // detected if the last index
        return true;
      }
    } else if (curr_label == label) { // continue with the previous entry
      valid_timestemp = curr_timestemp;
    } else if (last_valid_timestamp + this.tolerance_window_ms < curr_timestemp) {
      curr_label = null;
      target_state = 0;
      last_valid_timestamp = 0;
    }
  }

  return false;
}

InferenceEngine.prototype.dropOldEntries = function(curr_time, history_array, window_size) {
  let i;
  for (i = 0; i < history_array.length; i++) {
    if (curr_time - history_array[i][0] < window_size) {
      break;
    }
  }

  return history_array.slice(i, history_array.length);
}

InferenceEngine.prototype.accumulateArray = function(history_array) {
  let accum_history = [];
  for (var j = 0; j < this.num_class; j++) {
    accum_history.push(0);
  }

  for (var i = 0; i < history_array.length; i++) {
    for (var j = 0; j < this.num_class; j++) {
      accum_history[j] += history_array[i][1][j];
    }
  }

  return accum_history;
}

InferenceEngine.prototype.getPrediction = function(curr_time) {
  this.pred_history = this.dropOldEntries(curr_time, this.pred_history, this.smoothing_window_ms);

  this.final_score = this.accumulateArray(this.pred_history);

  let final_pred = 0;
  let max_val = 0;
  for (var i = 0; i < this.final_score.length; i++) {
    if (this.final_score[i] > max_val) {
      max_val = this.final_score[i];
      final_pred = i;
    }
  }

  this.label_history.push([curr_time, final_pred]);

  return final_pred;
}

InferenceEngine.prototype.infer = function(x, model) {
  let pred = model.predict(x);

  let total = 0;

  for (var i = 0; i < this.num_class; i++) {
    pred[i] = pred[i] * this.inference_weights[i];
    total += pred[i];
  }

  for (var i = 0; i < this.num_class; i++) {
    pred[i] = pred[i] / total;
  }

  var d = new Date();
  this.pred_history.push([d.getTime(), pred]);
  let label = this.getPrediction(d.getTime());
  let command = this.commands[label];

  // if (command == "hey" || command == "firefox") {
  //
  //   if (this.final_score[label] > this.predictionThreshold) {
  //     console.log("%c%s (%s)", "color:green", command, this.final_score[label]);
  //   } else if (this.final_score[label] > 0.75) {
  //     console.log("%c%s (%s)", "color:yellowgreen", command, this.final_score[label]);
  //   } else if (this.final_score[label] > 0.5) {
  //     console.log("%c%s (%s)", "color:gold", command, this.final_score[label]);
  //   } else if (this.final_score[label] > 0.25) {
  //     console.log("%c%s (%s)", "color:orange", command, this.final_score[label]);
  //   } else {
  //     console.log("%c%s (%s)", "color:red", command, this.final_score[label]);
  //   }
  // } else {
  //   // console.log("%s: %s (%s)", command, this.final_score[label]);
  // }

  return command
}

module.exports = InferenceEngine
