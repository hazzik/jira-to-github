var JiraApi = require('jira').JiraApi;
var GitHubApi = require('github');
var J2M = require('J2M');
var moment = require('moment');

//var util = require('util');

// The GitHub API handles concurrent inserts really badly
// Guess they are using optimistic locking without retry, or something like that
// Serializing requests fixes the issue
var https = require('https');
https.globalAgent.maxSockets = 1;

var config = require('./config');

var jira = new JiraApi(config.jira.proto, config.jira.host, config.jira.port, config.jira.user, config.jira.password, '2');
var github = new GitHubApi({ version: "3.0.0" });
github.authenticate({
    type: "basic",
    username: config.github.user,
    password: config.github.password
});

function html_time(dt){
	var m = moment(dt);
	return '<time datetime="' + m.toISOString() + '">' + m.utc().format('Do MMMM YYYY, H:mm:ss') + '</time>';
}

function markdown_quote(text) {
	return text.split(/\r?\n/).map(function(line){
			return '> ' + line;
	}).join('\r\n')
};

jira.searchJira(config.jira.jql, 
		{ 	
			maxResults: 10, 
			fields: [ 'summary', 'description', 'priority', 'components', 'issuetype', 'comment', 'reporter', 'created' ] 
		}, function(error, result) {

	result.issues.forEach(function(issue) {
		var labels = [];

		labels.push('p: '+ issue.fields.priority.name);

		issue.fields.components.forEach(function(component) {
				labels.push('c: '+ component.name);
		});

		labels.push('t: ' + issue.fields.issuetype.name);

		var body = '**' + issue.fields.reporter.displayName + '** created ' + issue.fields.issuetype.name + ' — ' + html_time(issue.fields.created) + ':\r\n' +
				markdown_quote(J2M.toM(issue.fields.description || ''));

		(issue.fields.comment.comments || []).forEach(function (comment) {
				body += '\r\n---\r\n';
				body += '**' + comment.author.displayName + '** added a comment — ' + html_time(comment.created) + ':\r\n';
				body += markdown_quote(J2M.toM(comment.body));
		});

		//console.log(issue);
		//console.log(issue.fields.comment.comments);

		github.issues.create({
			owner: config.github.repouser,
			repo: config.github.reponame, 
			title: issue.key + ' - ' + issue.fields.summary,
			body: body,
			labels: labels
		}, 
		function(err, res) { 
			if(err) {
					console.log(err);
					console.log("Error creating issue: " + issue.key + ' - ' + issue.fields.summary);
			}
			else
				console.log("Created issue: " + issue.key + ' - ' + issue.fields.summary);
		})

		//console.log(util.inspect(issue, false, null));

	})

});
